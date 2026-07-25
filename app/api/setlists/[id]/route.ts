import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs, songs, bandMembers, bands } from "@/src/db";
import { eq, asc, and } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";

// Mutações (renomear/excluir) continuam só do dono/líder.
async function loadOwnedSetlist(id: number, userId: number) {
  const [setlist] = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (!setlist) return null;
  if (setlist.userId !== userId) return "forbidden" as const;
  return setlist;
}

// Leitura (GET): dono OU membro ativo da banda dona da setlist (Frente E).
async function loadAccessibleSetlist(id: number, userId: number) {
  const [setlist] = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (!setlist) return null;
  if (setlist.userId === userId) return setlist;
  if (setlist.bandId) {
    const [member] = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, setlist.bandId), eq(bandMembers.userId, userId), eq(bandMembers.status, "active")))
      .limit(1);
    if (member) return setlist;
  }
  return "forbidden" as const;
}

// GET /api/setlists/:id — detalhe com musicas (ordenadas)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadAccessibleSetlist(id, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const items = await db
      .select({
        id: setlistSongs.id,
        position: setlistSongs.position,
        notes: setlistSongs.notes,
        // Preparo do repertório (S2): alimenta a duração total e os selos de
        // tom/velocidade na lista.
        transposeSemitones: setlistSongs.transposeSemitones,
        speed: setlistSongs.speed,
        gapSeconds: setlistSongs.gapSeconds,
        songId: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        genre: songs.genre,
        key: songs.key,
        bpm: songs.bpm,
        duration: songs.duration,
        thumbnailUrl: songs.thumbnailUrl,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, id))
      .orderBy(asc(setlistSongs.position), asc(setlistSongs.id));

    // Nome da banda (se for setlist compartilhada) + instrumento do viewer, para
    // que o player pré-mute tudo menos a trilha dele ao abrir a música (R2).
    let bandName: string | null = null;
    let viewerInstrument: string | null = null;
    if (setlist.bandId) {
      const [band] = await db.select({ name: bands.name }).from(bands).where(eq(bands.id, setlist.bandId)).limit(1);
      bandName = band?.name ?? null;
      const [membership] = await db
        .select({ instrument: bandMembers.instrument })
        .from(bandMembers)
        .where(and(eq(bandMembers.bandId, setlist.bandId), eq(bandMembers.userId, userId), eq(bandMembers.status, "active")))
        .limit(1);
      viewerInstrument = membership?.instrument ?? null;
    }

    return NextResponse.json({
      setlist: { ...setlist, bandName, viewerInstrument, canEdit: setlist.userId === userId },
      songs: items,
    });
  } catch (err) {
    console.error("[GET /api/setlists/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// PATCH /api/setlists/:id — renomear / atualizar anotacoes { name?, notes? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadOwnedSetlist(id, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const { name, notes } = await req.json() as { name?: string; notes?: string | null };
    const updates: Partial<typeof setlists.$inferInsert> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400 });
      if (name.trim().length > 200) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });
      updates.name = name.trim();
    }
    if (notes !== undefined) {
      updates.notes = notes?.trim() || null;
    }

    const [updated] = await db.update(setlists).set(updates).where(eq(setlists.id, id)).returning();
    return NextResponse.json({ setlist: updated });
  } catch (err) {
    console.error("[PATCH /api/setlists/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/setlists/:id — remover setlist
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!id) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadOwnedSetlist(id, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    await db.delete(setlists).where(and(eq(setlists.id, id), eq(setlists.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
