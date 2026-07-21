/**
 * POST /api/upload  (Fase 1.5 — upload do usuário final)
 *
 * NÃO é a mesma coisa que /api/admin/upload-url: aqui exige sessão NextAuth,
 * aplica quota por role e faz cache-lookup por hash ANTES de emitir a presigned
 * URL, para não subir o mesmo arquivo duas vezes (Frente B).
 *
 * Body: { filename: string; contentType: string; hash: string (SHA-256 hex) }
 * Resp (cache hit): { cached: true, songId, slug }
 * Resp (novo):      { cached: false, uploadUrl, key, publicUrl }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { eq } from "drizzle-orm";
import { presignPut, sanitizeKey } from "@/src/lib/r2";
import { checkUploadQuota } from "@/src/lib/quota";

const HASH_RE = /^[a-f0-9]{64}$/i;

function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "faixa";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { filename, contentType, hash } = (await req.json()) as {
    filename?: string;
    contentType?: string;
    hash?: string;
  };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename e contentType obrigatórios" }, { status: 400 });
  }
  if (!contentType.startsWith("audio/")) {
    return NextResponse.json({ error: "Só arquivos de áudio são aceitos" }, { status: 400 });
  }
  if (!hash || !HASH_RE.test(hash)) {
    return NextResponse.json({ error: "hash (SHA-256) inválido" }, { status: 400 });
  }

  const userId = Number(session.user.id);

  try {
    // ── Frente B: cache por hash ANTES de subir ──────────────────────────────
    const [existing] = await db
      .select({ id: songs.id, slug: songs.slug, processingStatus: songs.processingStatus })
      .from(songs)
      .where(eq(songs.sourceHash, hash))
      .limit(1);

    // Só é cache hit de verdade se o processamento anterior deu certo (ou está
    // em andamento). Se falhou, deixa cair pro fluxo normal — precisa tentar
    // de novo, não faz sentido "cachear" um erro.
    if (existing && existing.processingStatus !== "failed") {
      // Música já existe no catálogo — custo marginal zero, não sobe de novo.
      // (Vincular à biblioteca/setlist do usuário é responsabilidade da Frente E.)
      return NextResponse.json({ cached: true, songId: existing.id, slug: existing.slug });
    }

    // ── Quota (checagem preventiva; a autoritativa é no /confirm) ─────────────
    const quota = await checkUploadQuota(userId, session.user.role);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Limite mensal de uploads atingido",
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 },
      );
    }

    // ── Presigned URL para o mix original ─────────────────────────────────────
    const key = sanitizeKey(
      `audio/uploads/${userId}/${Date.now()}-${slugifyFilename(filename)}.orig`,
    );
    if (!key) {
      return NextResponse.json({ error: "Key inválida" }, { status: 400 });
    }

    const { uploadUrl, publicUrl } = await presignPut(key, contentType);
    return NextResponse.json({ cached: false, uploadUrl, key, publicUrl });
  } catch (err) {
    console.error("[POST /api/upload]", err);
    return NextResponse.json({ error: "Erro ao preparar upload" }, { status: 500 });
  }
}
