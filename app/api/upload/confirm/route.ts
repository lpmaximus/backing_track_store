/**
 * POST /api/upload/confirm  (Fase 1.5)
 *
 * Chamado pelo browser depois do PUT do arquivo no R2. Faz o trabalho
 * autoritativo: re-checa cache (corrida), checa quota de verdade, cria o
 * registro em `songs` e o `processing_jobs`, e dispara a separação.
 *
 * Body: { key, publicUrl, hash, filename, contentType }
 * Resp: { songId, slug, processingStatus }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { eq } from "drizzle-orm";
import { checkUploadQuota } from "@/src/lib/quota";
import { getSeparationProvider } from "@/src/lib/separation";

const HASH_RE = /^[a-f0-9]{64}$/i;

function slugifyFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "faixa"
  );
}

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 200) || "Faixa enviada";
}

function webhookBaseUrl(): string {
  return process.env.PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
}

/** Cria processing_job e dispara a separação num song já existente (novo ou retry). */
async function submitSeparation(songId: number, slug: string, audioUrl: string) {
  const provider = getSeparationProvider();
  const [job] = await db
    .insert(processingJobs)
    .values({ songId, provider: provider.name, stage: "separation", status: "pending" })
    .returning();

  const base = webhookBaseUrl();
  if (!base) {
    await db.update(songs).set({ processingStatus: "failed" }).where(eq(songs.id, songId));
    await db
      .update(processingJobs)
      .set({ status: "failed", errorMessage: "PUBLIC_BASE_URL/NEXTAUTH_URL não configurado" })
      .where(eq(processingJobs.id, job.id));
    return NextResponse.json({ error: "Servidor sem URL pública para webhook" }, { status: 500 });
  }

  const webhookUrl = `${base.replace(/\/$/, "")}/api/webhooks/separation?songId=${songId}`;

  try {
    const { providerJobId } = await provider.submit({ audioUrl, songId, webhookUrl });
    await db
      .update(processingJobs)
      .set({ providerJobId, status: "running" })
      .where(eq(processingJobs.id, job.id));
    await db.update(songs).set({ processingStatus: "separating" }).where(eq(songs.id, songId));
  } catch (submitErr) {
    console.error("[upload/confirm submit]", submitErr);
    await db
      .update(processingJobs)
      .set({ status: "failed", errorMessage: String(submitErr).slice(0, 500) })
      .where(eq(processingJobs.id, job.id));
    await db.update(songs).set({ processingStatus: "failed" }).where(eq(songs.id, songId));
    return NextResponse.json({ error: "Falha ao iniciar separação" }, { status: 502 });
  }

  return NextResponse.json({ songId, slug, processingStatus: "separating" });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { key, publicUrl, hash, filename, contentType } = (await req.json()) as {
    key?: string;
    publicUrl?: string;
    hash?: string;
    filename?: string;
    contentType?: string;
  };

  if (!publicUrl || !hash || !HASH_RE.test(hash) || !filename) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const userId = Number(session.user.id);

  try {
    // ── Insert com dedupe atômico (trata corrida no hash unique) ──────────────
    const slug = `${slugifyFilename(filename)}-${hash.slice(0, 8)}`;
    const [song] = await db
      .insert(songs)
      .values({
        slug,
        title: titleFromFilename(filename),
        artist: "Desconhecido",
        genre: "Outros",
        key: "?",
        bpm: 0,
        duration: 0,
        audioUrl: publicUrl, // mix original — será apagado ao fim do pipeline
        published: false,
        sourceType: "user_upload",
        uploadedByUserId: userId,
        sourceHash: hash,
        processingStatus: "queued",
        chordsSource: "auto",
        chordsStatus: "draft",
      })
      .onConflictDoNothing({ target: songs.sourceHash })
      .returning();

    // Conflito = já existe uma música com esse hash (outra requisição, ou uma
    // tentativa anterior do mesmo usuário).
    if (!song) {
      const [existing] = await db
        .select({ id: songs.id, slug: songs.slug, processingStatus: songs.processingStatus })
        .from(songs)
        .where(eq(songs.sourceHash, hash))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Erro ao confirmar upload" }, { status: 500 });
      }

      // Tentativa anterior falhou (ex.: sem crédito no provider) — reaproveita
      // o registro e dispara a separação de novo, em vez de fingir que já
      // está pronto.
      if (existing.processingStatus === "failed") {
        await db
          .update(songs)
          .set({ audioUrl: publicUrl, processingStatus: "queued" })
          .where(eq(songs.id, existing.id));
        return submitSeparation(existing.id, existing.slug, publicUrl);
      }

      // Já pronta, ou já em andamento por outra requisição — não duplica.
      return NextResponse.json({
        cached: true,
        songId: existing.id,
        slug: existing.slug,
        processingStatus: existing.processingStatus,
      });
    }

    // ── Quota autoritativa (agora que sabemos que é upload genuinamente novo) ─
    const quota = await checkUploadQuota(userId, session.user.role);
    if (!quota.allowed) {
      // Desfaz o registro recém-criado para não deixar lixo nem consumir quota.
      await db.delete(songs).where(eq(songs.id, song.id));
      return NextResponse.json(
        { error: "Limite mensal de uploads atingido", used: quota.used, limit: quota.limit },
        { status: 429 },
      );
    }

    // ── Cria o job e dispara a separação ──────────────────────────────────────
    return submitSeparation(song.id, song.slug, publicUrl);
  } catch (err) {
    console.error("[POST /api/upload/confirm]", err);
    return NextResponse.json({ error: "Erro ao confirmar upload" }, { status: 500 });
  }
}
