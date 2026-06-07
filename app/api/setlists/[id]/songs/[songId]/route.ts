import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs } from "@/src/db";
import { eq, and } from "drizzle-orm";

function requirePro(role?: string) {
  return role === "pro" || role === "admin";
}

async function loadOwnedSetlist(id: number, userId: number) {
  const [setlist] = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (!setlist) return null;
  if (setlist.userId !== userId) return "forbidden" as const;
  return setlist;
}

// PATCH /api/setlists/:id/songs/:songId — atualiza posicao e/ou anotacao do item
// Observacao: ":songId" aqui é o ID da linha em setlist_songs (item da setlist), nao o ID da musica.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; songId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!requirePro(session.user.role)) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam, songId: itemIdParam } = await params;
    const setlistId = Number(idParam);
    const itemId = Number(itemIdParam);
    if (!setlistId || !itemId) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadOwnedSetlist(setlistId, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    const [item] = await db.select().from(setlistSongs)
      .where(and(eq(setlistSongs.id, itemId), eq(setlistSongs.setlistId, setlistId)))
      .limit(1);
    if (!item) return NextResponse.json({ error: "Item nao encontrado" }, { status: 404 });

    const { position, notes } = await req.json() as { position?: number; notes?: string | null };
    const updates: Partial<typeof setlistSongs.$inferInsert> = {};
    if (position !== undefined) updates.position = position;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    const [updated] = await db.update(setlistSongs).set(updates).where(eq(setlistSongs.id, itemId)).returning();
    await db.update(setlists).set({ updatedAt: new Date() }).where(eq(setlists.id, setlistId));

    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error("[PATCH /api/setlists/:id/songs/:songId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/setlists/:id/songs/:songId — remove musica da setlist (item da setlist_songs)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; songId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!requirePro(session.user.role)) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { id: idParam, songId: itemIdParam } = await params;
    const setlistId = Number(idParam);
    const itemId = Number(itemIdParam);
    if (!setlistId || !itemId) return NextResponse.json({ error: "ID invalido" }, { status: 400 });

    const userId = Number(session.user.id);
    const setlist = await loadOwnedSetlist(setlistId, userId);
    if (!setlist) return NextResponse.json({ error: "Setlist nao encontrada" }, { status: 404 });
    if (setlist === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    await db.delete(setlistSongs).where(and(eq(setlistSongs.id, itemId), eq(setlistSongs.setlistId, setlistId)));
    await db.update(setlists).set({ updatedAt: new Date() }).where(eq(setlists.id, setlistId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id/songs/:songId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
