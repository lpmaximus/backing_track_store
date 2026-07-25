/**
 * Pauta (antes) e ata (depois) do ensaio — Fase S1 / ADR-BTS-005.
 *   POST   → põe uma música do repertório na pauta. Só o LÍDER (D11).
 *   PATCH  → marca ok / repetir e anota. Só o LÍDER.
 *   DELETE → tira a música da pauta. Só o LÍDER.
 *
 * O item marcado como `repeat` é o que alimenta a pauta do ensaio seguinte —
 * é isso que faz o registro continuar sendo usado na segunda semana.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistEventItems, setlistSongs } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { resolveEventRole, canManageEvent, ITEM_STATUSES, type ItemStatus } from "@/src/lib/events";

/** Autoriza e devolve o setlistId do evento, ou a resposta de erro pronta. */
type Guard =
  | { ok: false; error: NextResponse }
  | { ok: true; setlistId: number };

async function guardLeader(eventId: number, userId: number): Promise<Guard> {
  const { role, setlistId } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") {
    return { ok: false, error: NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 }) };
  }
  if (!canManageEvent(role) || setlistId == null) {
    return { ok: false, error: NextResponse.json({ error: "Só o líder edita a pauta" }, { status: 403 }) };
  }
  return { ok: true, setlistId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const guard = await guardLeader(eventId, Number(session.user.id));
  if (!guard.ok) return guard.error;

  try {
    const { setlistSongId } = (await req.json()) as { setlistSongId?: number };
    if (!setlistSongId) return NextResponse.json({ error: "setlistSongId obrigatório" }, { status: 400 });

    // A música tem de pertencer ao setlist deste evento — impede pauta com
    // música de outro repertório via ID adivinhado.
    const [song] = await db
      .select({ id: setlistSongs.id })
      .from(setlistSongs)
      .where(and(eq(setlistSongs.id, setlistSongId), eq(setlistSongs.setlistId, guard.setlistId)))
      .limit(1);
    if (!song) return NextResponse.json({ error: "Música não está neste setlist" }, { status: 400 });

    const [existing] = await db
      .select({ id: setlistEventItems.id })
      .from(setlistEventItems)
      .where(
        and(eq(setlistEventItems.eventId, eventId), eq(setlistEventItems.setlistSongId, setlistSongId)),
      )
      .limit(1);
    if (existing) return NextResponse.json({ error: "Música já está na pauta" }, { status: 409 });

    const [created] = await db
      .insert(setlistEventItems)
      .values({ eventId, setlistSongId })
      .returning();

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists/:id/events/:eventId/items]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const guard = await guardLeader(eventId, Number(session.user.id));
  if (!guard.ok) return guard.error;

  try {
    const { itemId, status, note } = (await req.json()) as {
      itemId?: number;
      status?: string;
      note?: string | null;
    };
    if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!ITEM_STATUSES.includes(status as ItemStatus)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
      patch.status = status;
    }
    if (note !== undefined) patch.note = note?.trim() || null;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const [updated] = await db
      .update(setlistEventItems)
      .set(patch)
      .where(and(eq(setlistEventItems.id, itemId), eq(setlistEventItems.eventId, eventId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    return NextResponse.json({ item: updated });
  } catch (err) {
    console.error("[PATCH /api/setlists/:id/events/:eventId/items]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const guard = await guardLeader(eventId, Number(session.user.id));
  if (!guard.ok) return guard.error;

  try {
    const itemId = Number(req.nextUrl.searchParams.get("itemId"));
    if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

    await db
      .delete(setlistEventItems)
      .where(and(eq(setlistEventItems.id, itemId), eq(setlistEventItems.eventId, eventId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id/events/:eventId/items]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
