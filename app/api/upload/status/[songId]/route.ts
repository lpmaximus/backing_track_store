/**
 * GET /api/upload/status/:songId  (Fase 1.5)
 * Poll simples do progresso do pipeline. Só o dono do upload (ou admin) vê.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ songId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { songId: songIdParam } = await params;
  const songId = Number(songIdParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [song] = await db
      .select({
        id: songs.id,
        slug: songs.slug,
        processingStatus: songs.processingStatus,
        uploadedByUserId: songs.uploadedByUserId,
      })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const userId = Number(session.user.id);
    if (song.uploadedByUserId !== userId && session.user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const [job] = await db
      .select({ stage: processingJobs.stage, status: processingJobs.status, error: processingJobs.errorMessage })
      .from(processingJobs)
      .where(eq(processingJobs.songId, songId))
      .orderBy(desc(processingJobs.id))
      .limit(1);

    return NextResponse.json({
      songId: song.id,
      slug: song.slug,
      processingStatus: song.processingStatus,
      stage: job?.stage ?? null,
      jobStatus: job?.status ?? null,
      error: job?.error ?? null,
    });
  } catch (err) {
    console.error("[GET /api/upload/status]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
