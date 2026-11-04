/**
 * POST /api/songs/:id/reprocess  — "Tentar de novo" da cifra e/ou da letra.
 *
 * Body: { stage?: "chords" | "lyrics" | "both" }   (padrão: "both")
 *
 * Por que existe: um job de cifra/letra que termina `failed` era definitivo e o
 * painel ficava vazio para sempre, sem o usuário poder fazer nada. Aqui o DONO da
 * música (ou um admin) recoloca o job na fila; a mesma fila de sempre
 * (src/lib/jobs/queue.ts) submete e finaliza.
 *
 * Regras:
 *  - só dono do upload ou admin;
 *  - a música precisa estar separada (processingStatus = ready);
 *  - não duplica: se já há job pendente/rodando daquele estágio, não cria outro;
 *  - não sobrescreve cifra/letra que já existe.
 * Cada tentativa custa centavos no Replicate, por isso só roda por pedido explícito.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, inArray } from "drizzle-orm";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { enqueueJob, submitJob, type JobStage } from "@/src/lib/jobs/queue";

type StageChoice = "chords" | "lyrics" | "both";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let stage: StageChoice = "both";
  try {
    const body = (await req.json()) as { stage?: StageChoice };
    if (body.stage === "chords" || body.stage === "lyrics" || body.stage === "both") stage = body.stage;
  } catch {
    /* sem corpo = both */
  }

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

    const userId = Number(session.user.id);
    const isOwner = song.uploadedByUserId === userId;
    const isAdmin = session.user.role === "admin";
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

    if (song.processingStatus !== "ready") {
      return NextResponse.json({ error: "A música ainda não terminou de ser separada" }, { status: 409 });
    }

    const wanted: { key: "chords" | "lyrics"; stage: JobStage }[] = [];
    if (stage !== "lyrics") wanted.push({ key: "chords", stage: "chord_detection" });
    if (stage !== "chords") wanted.push({ key: "lyrics", stage: "lyrics_detection" });

    const result: Record<string, string> = {};

    for (const w of wanted) {
      const hasContent =
        w.key === "chords"
          ? Boolean(song.chords && song.chords.length > 0)
          : Boolean(song.lyrics && song.lyrics.length > 0);
      if (hasContent) { result[w.key] = "already_has"; continue; }

      const provider = w.key === "chords" ? getChordProvider() : getLyricsProvider();
      if (!provider.isConfigured()) { result[w.key] = "not_configured"; continue; }

      const active = await db
        .select({ id: processingJobs.id })
        .from(processingJobs)
        .where(
          and(
            eq(processingJobs.songId, songId),
            eq(processingJobs.stage, w.stage),
            inArray(processingJobs.status, ["pending", "running"]),
          ),
        )
        .limit(1);
      if (active.length > 0) { result[w.key] = "already_running"; continue; }

      const job = await enqueueJob(songId, w.stage, provider.name);
      const outcome = await submitJob(job); // 429 do Replicate = fica na fila, não é erro
      result[w.key] = outcome === "failed" ? "failed" : "queued";
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/songs/:id/reprocess]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
