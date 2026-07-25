/**
 * Detalhe de um ensaio/show (Fase S1 / ADR-BTS-005).
 *   GET    → tudo que a página do ensaio precisa, numa chamada só.
 *   PATCH  → edita evento e ata. Só o LÍDER (D11).
 *   DELETE → apaga o evento. Só o LÍDER.
 *
 * O GET devolve a MESMA carga para líder e integrante — quem decide o que
 * mostrar é a tela. Isso é deliberado: a grade de prontidão é legível por toda
 * a banda (D12), e esconder no servidor criaria duas versões da verdade.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  db,
  setlists,
  setlistEvents,
  setlistEventItems,
  setlistEventAttendance,
  setlistAssignments,
  setlistSongs,
  songs,
  bandMembers,
  users,
} from "@/src/db";
import { and, asc, eq } from "drizzle-orm";
import { resolveEventRole, canManageEvent, EVENT_TYPES, type EventType } from "@/src/lib/events";

async function loadEvent(eventId: number, setlistId: number) {
  const [ev] = await db
    .select()
    .from(setlistEvents)
    .where(and(eq(setlistEvents.id, eventId), eq(setlistEvents.setlistId, setlistId)))
    .limit(1);
  return ev ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam, eventId: evParam } = await params;
  const setlistId = Number(idParam);
  const eventId = Number(evParam);
  if (!setlistId || !eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const { role } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });
  if (role.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const event = await loadEvent(eventId, setlistId);
    if (!event) return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });

    const [setlist] = await db
      .select({ id: setlists.id, name: setlists.name, bandId: setlists.bandId })
      .from(setlists)
      .where(eq(setlists.id, setlistId))
      .limit(1);

    // Repertório completo do setlist — o líder escolhe daqui o que entra na pauta.
    const repertoire = await db
      .select({
        setlistSongId: setlistSongs.id,
        position: setlistSongs.position,
        notes: setlistSongs.notes,
        songId: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        key: songs.key,
        bpm: songs.bpm,
        duration: songs.duration,
        thumbnailUrl: songs.thumbnailUrl,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, setlistId))
      .orderBy(asc(setlistSongs.position));

    // Pauta do ensaio (subconjunto do repertório) + ata.
    const items = await db
      .select({
        id: setlistEventItems.id,
        setlistSongId: setlistEventItems.setlistSongId,
        status: setlistEventItems.status,
        note: setlistEventItems.note,
      })
      .from(setlistEventItems)
      .where(eq(setlistEventItems.eventId, eventId));

    // Escalação + prontidão.
    const assignments = await db
      .select({
        id: setlistAssignments.id,
        setlistSongId: setlistAssignments.setlistSongId,
        userId: setlistAssignments.userId,
        userName: users.name,
        userImage: users.image,
        instrument: setlistAssignments.instrument,
        focus: setlistAssignments.focus,
        loopStartSec: setlistAssignments.loopStartSec,
        loopEndSec: setlistAssignments.loopEndSec,
        readiness: setlistAssignments.readiness,
        updatedAt: setlistAssignments.updatedAt,
      })
      .from(setlistAssignments)
      .innerJoin(users, eq(setlistAssignments.userId, users.id))
      .where(eq(setlistAssignments.eventId, eventId));

    const attendance = await db
      .select({
        userId: setlistEventAttendance.userId,
        status: setlistEventAttendance.status,
        respondedAt: setlistEventAttendance.respondedAt,
      })
      .from(setlistEventAttendance)
      .where(eq(setlistEventAttendance.eventId, eventId));

    // Integrantes ativos — quem o líder pode escalar. Setlist pessoal não tem.
    const members = setlist?.bandId
      ? await db
          .select({
            userId: bandMembers.userId,
            name: users.name,
            image: users.image,
            instrument: bandMembers.instrument,
          })
          .from(bandMembers)
          .innerJoin(users, eq(bandMembers.userId, users.id))
          .where(and(eq(bandMembers.bandId, setlist.bandId), eq(bandMembers.status, "active")))
      : [];

    return NextResponse.json({
      role: role.kind,
      viewerId: userId,
      viewerInstrument: role.instrument,
      setlist: setlist ?? null,
      event,
      repertoire,
      items,
      assignments,
      attendance,
      members,
    });
  } catch (err) {
    console.error("[GET /api/setlists/:id/events/:eventId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam, eventId: evParam } = await params;
  const setlistId = Number(idParam);
  const eventId = Number(evParam);
  if (!setlistId || !eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const { role } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });
  if (!canManageEvent(role)) {
    return NextResponse.json({ error: "Só o líder da banda edita o ensaio" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      type?: string;
      title?: string;
      startsAt?: string;
      durationMin?: number | null;
      location?: string | null;
      agenda?: string | null;
      minutes?: string | null;
    };

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.type !== undefined) {
      if (!EVENT_TYPES.includes(body.type as EventType)) {
        return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
      }
      patch.type = body.type;
    }
    if (body.title !== undefined) {
      const t = body.title.trim();
      if (!t) return NextResponse.json({ error: "Informe um título" }, { status: 400 });
      patch.title = t.slice(0, 200);
    }
    if (body.startsAt !== undefined) {
      const d = new Date(body.startsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Data e hora inválidas" }, { status: 400 });
      }
      patch.startsAt = d;
    }
    if (body.durationMin !== undefined) patch.durationMin = body.durationMin ?? null;
    if (body.location !== undefined) patch.location = body.location?.trim() || null;
    if (body.agenda !== undefined) patch.agenda = body.agenda?.trim() || null;
    if (body.minutes !== undefined) patch.minutes = body.minutes?.trim() || null;

    const [updated] = await db
      .update(setlistEvents)
      .set(patch)
      .where(and(eq(setlistEvents.id, eventId), eq(setlistEvents.setlistId, setlistId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });
    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error("[PATCH /api/setlists/:id/events/:eventId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam, eventId: evParam } = await params;
  const setlistId = Number(idParam);
  const eventId = Number(evParam);
  if (!setlistId || !eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const { role } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });
  if (!canManageEvent(role)) {
    return NextResponse.json({ error: "Só o líder da banda apaga o ensaio" }, { status: 403 });
  }

  try {
    // Pauta, escalação e presença caem por ON DELETE CASCADE.
    await db
      .delete(setlistEvents)
      .where(and(eq(setlistEvents.id, eventId), eq(setlistEvents.setlistId, setlistId)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id/events/:eventId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
