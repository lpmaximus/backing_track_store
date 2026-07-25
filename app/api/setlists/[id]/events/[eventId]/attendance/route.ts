/**
 * Presença no ensaio (Fase S1 / ADR-BTS-005, D3).
 *   PUT → responde vou / não vou / talvez. Cada um responde SÓ POR SI —
 *         nem o líder responde pelo integrante.
 *
 * O convite continua sendo para a BANDA (token + QR, já implementado). Aqui é
 * só confirmação: um campo, não um fluxo de convite.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistEventAttendance } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { resolveEventRole, ATTENDANCE_STATUSES, type AttendanceStatus } from "@/src/lib/events";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { eventId: evParam } = await params;
  const eventId = Number(evParam);
  if (!eventId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const { role } = await resolveEventRole(eventId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Ensaio não encontrado" }, { status: 404 });
  if (role.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const { status } = (await req.json()) as { status?: string };
    if (!status || !ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
      return NextResponse.json({ error: "Resposta inválida" }, { status: 400 });
    }

    // Upsert manual: o índice único (event_id, user_id) garante uma linha por
    // pessoa; trocar de ideia atualiza a resposta em vez de empilhar.
    const [existing] = await db
      .select({ id: setlistEventAttendance.id })
      .from(setlistEventAttendance)
      .where(
        and(eq(setlistEventAttendance.eventId, eventId), eq(setlistEventAttendance.userId, userId)),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(setlistEventAttendance)
        .set({ status, respondedAt: new Date() })
        .where(eq(setlistEventAttendance.id, existing.id))
        .returning();
      return NextResponse.json({ attendance: updated });
    }

    const [created] = await db
      .insert(setlistEventAttendance)
      .values({ eventId, userId, status })
      .returning();
    return NextResponse.json({ attendance: created }, { status: 201 });
  } catch (err) {
    console.error("[PUT /api/setlists/:id/events/:eventId/attendance]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
