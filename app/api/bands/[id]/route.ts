/**
 * GET /api/bands/:id  (Fase 1.5, Frente E)
 * Detalhe da banda + membros. Acesso: líder ou membro ativo.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, bands, bandMembers, users } from "@/src/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const bandId = Number(id);
  if (!bandId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1);
    if (!band) return NextResponse.json({ error: "Banda não encontrada" }, { status: 404 });

    const userId = Number(session.user.id);
    const isLeader = band.leaderUserId === userId;

    const members = await db
      .select({
        id: bandMembers.id,
        userId: bandMembers.userId,
        instrument: bandMembers.instrument,
        status: bandMembers.status,
        invitedEmail: bandMembers.invitedEmail,
        email: users.email,
        name: users.name,
      })
      .from(bandMembers)
      .leftJoin(users, eq(bandMembers.userId, users.id))
      .where(eq(bandMembers.bandId, bandId));

    const isMember = isLeader || members.some((m) => m.userId === userId && m.status === "active");
    if (!isMember) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    return NextResponse.json({
      band: { ...band, isLeader },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        instrument: m.instrument,
        status: m.status,
        display: m.name || m.email || m.invitedEmail || "convidado",
        isLeader: m.userId === band.leaderUserId,
      })),
    });
  } catch (err) {
    console.error("[GET /api/bands/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
