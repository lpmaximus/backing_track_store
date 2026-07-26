/**
 * GET /api/account/me  (Área do Usuário)
 *
 * Dados básicos da conta do usuário logado: os mesmos que hoje só apareciam
 * espalhados no header/dropdown. Inclui as bandas em que participa (ativo),
 * para exibir na Área do Usuário.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, users, bandMembers, bands } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { roleLabel } from "@/src/lib/roles";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = Number(session.user.id);

  try {
    const [me] = await db
      .select({
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!me) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const myBands = await db
      .select({ id: bands.id, name: bands.name, isLeader: bands.leaderUserId })
      .from(bandMembers)
      .innerJoin(bands, eq(bandMembers.bandId, bands.id))
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active")));

    return NextResponse.json({
      ...me,
      tier: roleLabel(me.role, myBands.length > 0),
      bands: myBands.map((b) => ({ id: b.id, name: b.name, leader: b.isLeader === userId })),
    });
  } catch (err) {
    console.error("[GET /api/account/me]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
