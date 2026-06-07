import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs, songs } from "@/src/db";
import { eq, max } from "drizzle-orm";

function requirePro(role?: string) {
  return role === "pro" || role === "admin";
}

async function loadOwnedSetlist(id: number, userId: number) {
  const [setlist] = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (!setlist) return null;
  if (setlist.userId !== userId) return "forbidden" as const;
  return setlist;
}

// POST /api/setlists/:id/songs — adiciona musica { songId, notes? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!requirePro(session.user.role)) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam } = await params;
    const setlistId = Number(idParam);
    if (!setlistId) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadOwnedSetlist(setlistId, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { songId, notes } = await req.json() as { songId?: number; notes?: string };
    if (!songId) return NextResponse.json({ error: "songId obrigatorio" }, { status: 400 });

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Musica nao encontrada" }, { status: 404 });

    const [{ maxPos }] = await db
      .select({ maxPos: max(setlistSongs.position) })
      .from(setlistSongs)
      .where(eq(setlistSongs.setlistId, setlistId));

    const [created] = await db.insert(setlistSongs).values({
      setlistId,
      songId,
      position: (maxPos ?? -1) + 1,
      notes: notes?.trim() || null,
    }).returning();

    await db.update(setlists).set({ updatedAt: new Date() }).where(eq(setlists.id, setlistId));

    return NextResponse.json({
      item: {
        id: created.id,
        position: created.position,
        notes: created.notes,
        songId: song.id,
        slug: song.slug,
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        key: song.key,
        bpm: song.bpm,
        thumbnailUrl: song.thumbnailUrl,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists/:id/songs]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
