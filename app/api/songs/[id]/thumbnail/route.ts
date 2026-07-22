/**
 * POST /api/songs/:id/thumbnail
 * Gera uma presigned URL do R2 para o dono trocar a capa (thumbnail) da música.
 *
 * Fluxo (igual ao upload de áudio, mas para imagem):
 *   1. POST { contentType } → recebe { uploadUrl, publicUrl }
 *   2. PUT uploadUrl com o arquivo (direto do browser → R2)
 *   3. PATCH /api/songs/:id { thumbnailUrl: publicUrl } grava no banco
 *
 * Só o dono do upload (uploadedByUserId) ou um admin pode gerar a URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { eq } from "drizzle-orm";
import { presignPut, sanitizeKey } from "@/src/lib/r2";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { contentType } = (await req.json().catch(() => ({}))) as { contentType?: string };
  if (!contentType || !EXT[contentType]) {
    return NextResponse.json(
      { error: "Formato inválido. Use JPG, PNG ou WEBP." },
      { status: 400 },
    );
  }

  const userId = Number(session.user.id);
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

  const isOwner = song.uploadedByUserId === userId;
  const isAdmin = session.user.role === "admin";
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const key = sanitizeKey(`images/thumbnails/${userId}/${songId}-${Date.now()}.${EXT[contentType]}`);
  if (!key) return NextResponse.json({ error: "Key inválida" }, { status: 400 });

  try {
    const { uploadUrl, publicUrl } = await presignPut(key, contentType);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[POST /api/songs/:id/thumbnail]", err);
    return NextResponse.json({ error: "Erro ao preparar upload" }, { status: 500 });
  }
}
