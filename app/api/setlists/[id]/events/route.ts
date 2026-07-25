/**
 * Ensaios e shows de um setlist (Fase S1 / ADR-BTS-005).
 *   GET  → lista os eventos do setlist (líder e membros ativos leem).
 *   POST → cria evento. Só o LÍDER (D11).
 *
 * O Setlist é o repertório; o Evento é a ocorrência datada (D1).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistEvents, setlistAssignments, setlistEventAttendance } from "@/src/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { resolveSetlistRole, canManageEvent, EVENT_TYPES, type EventType } from "@/src/lib/events";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const setlistId = Number(idParam);
  if (!setlistId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const role = await resolveSetlistRole(setlistId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (role.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const rows = await db
      .select({
        id: setlistEvents.id,
        type: setlistEvents.type,
        title: setlistEvents.title,
        startsAt: setlistEvents.startsAt,
        durationMin: setlistEvents.durationMin,
        location: setlistEvents.location,
        agenda: setlistEvents.agenda,
        minutes: setlistEvents.minutes,
      })
      .from(setlistEvents)
      .where(eq(setlistEvents.setlistId, setlistId))
      .orderBy(asc(setlistEvents.startsAt));

    // Contadores por evento para a lista: quantos escalados e quantos prontos
    // (D12 — a grade é legível por toda a banda) + a minha própria presença.
    // O join com setlist_events restringe ao setlist pedido — sem ele a
    // agregação varreria a tabela inteira, de todas as bandas.
    const counts = await db
      .select({
        eventId: setlistAssignments.eventId,
        total: sql<number>`count(*)::int`,
        ready: sql<number>`count(*) filter (where ${setlistAssignments.readiness} = 'ready')::int`,
        mine: sql<number>`count(*) filter (where ${setlistAssignments.userId} = ${userId})::int`,
      })
      .from(setlistAssignments)
      .innerJoin(setlistEvents, eq(setlistAssignments.eventId, setlistEvents.id))
      .where(eq(setlistEvents.setlistId, setlistId))
      .groupBy(setlistAssignments.eventId);

    const myAttendance = await db
      .select({ eventId: setlistEventAttendance.eventId, status: setlistEventAttendance.status })
      .from(setlistEventAttendance)
      .innerJoin(setlistEvents, eq(setlistEventAttendance.eventId, setlistEvents.id))
      .where(
        and(
          eq(setlistEventAttendance.userId, userId),
          eq(setlistEvents.setlistId, setlistId),
        ),
      );

    const byId = new Map(counts.map((c) => [c.eventId, c]));
    const attById = new Map(myAttendance.map((a) => [a.eventId, a.status]));

    return NextResponse.json({
      role: role.kind,
      events: rows.map((e) => ({
        ...e,
        assignedCount: byId.get(e.id)?.total ?? 0,
        readyCount: byId.get(e.id)?.ready ?? 0,
        myAssignments: byId.get(e.id)?.mine ?? 0,
        myAttendance: attById.get(e.id) ?? null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/setlists/:id/events]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const setlistId = Number(idParam);
  if (!setlistId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const role = await resolveSetlistRole(setlistId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (!canManageEvent(role)) {
    return NextResponse.json({ error: "Só o líder da banda cria ensaios" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      type?: string;
      title?: string;
      startsAt?: string;
      durationMin?: number | null;
      location?: string | null;
      agenda?: string | null;
    };

    const type = (body.type ?? "rehearsal") as EventType;
    if (!EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }

    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "Informe um título" }, { status: 400 });
    if (title.length > 200) return NextResponse.json({ error: "Título muito longo" }, { status: 400 });

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Data e hora inválidas" }, { status: 400 });
    }

    // D14: sem teto de eventos — evento é texto e data, o custo real é o áudio.
    const [created] = await db
      .insert(setlistEvents)
      .values({
        setlistId,
        bandId: role.bandId,
        type,
        title,
        startsAt,
        durationMin: body.durationMin ?? null,
        location: body.location?.trim() || null,
        agenda: body.agenda?.trim() || null,
        createdBy: userId,
      })
      .returning();

    return NextResponse.json({ event: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists/:id/events]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
