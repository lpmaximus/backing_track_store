import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs } from "@/src/db";
import { eq, and } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import { clampTranspose, parseSpeed } from "@/src/lib/mix";

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
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
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

    const { position, notes, transposeSemitones, speed, gapSeconds } = await req.json() as {
      position?: number;
      notes?: string | null;
      transposeSemitones?: number;
      speed?: number;
      gapSeconds?: number;
    };
    const updates: Partial<typeof setlistSongs.$inferInsert> = {};
    if (position !== undefined) updates.position = position;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    // Preparo do repertório (S2 / ADR-BTS-005). Limites vêm de src/lib/mix.ts —
    // fora deles o pitch shift do player degrada audivelmente.
    if (transposeSemitones !== undefined) {
      updates.transposeSemitones = clampTranspose(transposeSemitones);
    }
    if (speed !== undefined) {
      updates.speed = parseSpeed(speed).toFixed(2);
    }
    if (gapSeconds !== undefined) {
      const g = Number(gapSeconds);
      updates.gapSeconds = Number.isFinite(g) ? Math.max(0, Math.min(60, Math.round(g))) : 0;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

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
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
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
