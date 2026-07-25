/**
 * Escalação e prontidão — Fase S1 / ADR-BTS-005 (D4).
 *   POST   → escala alguém numa música da pauta. Só o LÍDER (D11).
 *   PATCH  → dois donos distintos, de propósito:
 *              · `readiness` → SÓ o próprio escalado. Nem o líder muda.
 *              · foco e trecho de loop → só o líder.
 *   DELETE → desfaz a escalação. Só o líder.
 *
 * O status de prontidão é a única informação que sobe do integrante para o
 * líder. Se o líder pudesse marcá-lo, o dado perderia o sentido: viraria o que
 * o líder acha, não o que o músico sabe.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistAssignments, setlistSongs, bandMembers } from "@/src/db";
import { and, eq } from "drizzle-orm";
import {
  resolveEventRole,
  canManageEvent,
  READINESS_LEVELS,
  type Readiness,
  type SetlistRole,
} from "@/src/lib/events";

function bad(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return bad("Não autenticado", 401);

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return bad("ID inválido", 400);

  const userId = Number(session.user.id);
  const { role, setlistId } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return bad("Ensaio não encontrado", 404);
  if (!canManageEvent(role)) return bad("Só o líder escala integrantes", 403);

  try {
    const body = (await req.json()) as {
      setlistSongId?: number;
      userId?: number;
      instrument?: string | null;
      focus?: string | null;
      loopStartSec?: number | null;
      loopEndSec?: number | null;
    };
    if (!body.setlistSongId || !body.userId) {
      return bad("setlistSongId e userId são obrigatórios", 400);
    }

    // A música tem de ser do setlist deste evento.
    const [song] = await db
      .select({ id: setlistSongs.id })
      .from(setlistSongs)
      .where(and(eq(setlistSongs.id, body.setlistSongId), eq(setlistSongs.setlistId, setlistId!)))
      .limit(1);
    if (!song) return bad("Música não está neste setlist", 400);

    // Só dá para escalar integrante ATIVO da banda. Em setlist pessoal
    // (bandId null) o único escalável é o próprio dono.
    let instrument = body.instrument ?? null;
    if (role.bandId != null) {
      const [m] = await db
        .select({ instrument: bandMembers.instrument })
        .from(bandMembers)
        .where(
          and(
            eq(bandMembers.bandId, role.bandId),
            eq(bandMembers.userId, body.userId),
            eq(bandMembers.status, "active"),
          ),
        )
        .limit(1);
      if (!m) return bad("Essa pessoa não é integrante ativo da banda", 400);
      // O instrumento vem do cadastro do membro; o corpo só sobrescreve quando
      // o líder escala alguém fora do instrumento habitual.
      instrument = instrument ?? m.instrument;
    } else if (body.userId !== userId) {
      return bad("Setlist pessoal só escala o próprio dono", 400);
    }

    const [existing] = await db
      .select({ id: setlistAssignments.id })
      .from(setlistAssignments)
      .where(
        and(
          eq(setlistAssignments.eventId, eventId),
          eq(setlistAssignments.setlistSongId, body.setlistSongId),
          eq(setlistAssignments.userId, body.userId),
        ),
      )
      .limit(1);
    if (existing) return bad("Integrante já escalado nessa música", 409);

    const [created] = await db
      .insert(setlistAssignments)
      .values({
        eventId,
        setlistSongId: body.setlistSongId,
        userId: body.userId,
        instrument,
        focus: body.focus?.trim() || null,
        loopStartSec: body.loopStartSec ?? null,
        loopEndSec: body.loopEndSec ?? null,
      })
      .returning();

    return NextResponse.json({ assignment: created }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists/:id/events/:eventId/assignments]", err);
    return bad("Erro interno", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return bad("Não autenticado", 401);

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return bad("ID inválido", 400);

  const userId = Number(session.user.id);
  const { role }: { role: SetlistRole } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return bad("Ensaio não encontrado", 404);
  if (role.kind === "forbidden") return bad("Acesso negado", 403);

  try {
    const body = (await req.json()) as {
      assignmentId?: number;
      readiness?: string;
      focus?: string | null;
      loopStartSec?: number | null;
      loopEndSec?: number | null;
    };
    if (!body.assignmentId) return bad("assignmentId obrigatório", 400);

    const [row] = await db
      .select({ id: setlistAssignments.id, userId: setlistAssignments.userId })
      .from(setlistAssignments)
      .where(
        and(eq(setlistAssignments.id, body.assignmentId), eq(setlistAssignments.eventId, eventId)),
      )
      .limit(1);
    if (!row) return bad("Escalação não encontrada", 404);

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.readiness !== undefined) {
      // D4: só o próprio escalado mexe no semáforo.
      if (row.userId !== userId) {
        return bad("Só quem foi escalado marca a própria prontidão", 403);
      }
      if (!READINESS_LEVELS.includes(body.readiness as Readiness)) {
        return bad("Status de prontidão inválido", 400);
      }
      patch.readiness = body.readiness;
    }

    const leaderFields =
      body.focus !== undefined || body.loopStartSec !== undefined || body.loopEndSec !== undefined;
    if (leaderFields) {
      if (!canManageEvent(role)) return bad("Só o líder edita foco e trecho", 403);
      if (body.focus !== undefined) patch.focus = body.focus?.trim() || null;
      if (body.loopStartSec !== undefined) patch.loopStartSec = body.loopStartSec ?? null;
      if (body.loopEndSec !== undefined) patch.loopEndSec = body.loopEndSec ?? null;
    }

    if (Object.keys(patch).length === 1) return bad("Nada para atualizar", 400);

    const [updated] = await db
      .update(setlistAssignments)
      .set(patch)
      .where(eq(setlistAssignments.id, body.assignmentId))
      .returning();

    return NextResponse.json({ assignment: updated });
  } catch (err) {
    console.error("[PATCH /api/setlists/:id/events/:eventId/assignments]", err);
    return bad("Erro interno", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return bad("Não autenticado", 401);

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return bad("ID inválido", 400);

  const { role } = await resolveEventRole(eventId, Number(session.user.id));
  if (role.kind === "notfound") return bad("Ensaio não encontrado", 404);
  if (!canManageEvent(role)) return bad("Só o líder desfaz a escalação", 403);

  try {
    const assignmentId = Number(req.nextUrl.searchParams.get("assignmentId"));
    if (!assignmentId) return bad("assignmentId obrigatório", 400);

    await db
      .delete(setlistAssignments)
      .where(and(eq(setlistAssignments.id, assignmentId), eq(setlistAssignments.eventId, eventId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id/events/:eventId/assignments]", err);
    return bad("Erro interno", 500);
  }
}
