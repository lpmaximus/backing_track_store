/**
 * /api/bands  (Fase 1.5, Frente E)
 *   POST → cria banda (o criador vira líder e membro ativo).
 *   GET  → lista bandas onde o usuário é líder ou membro ativo.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, bands, bandMembers, subscriptions } from "@/src/db";
import { and, eq, inArray } from "drizzle-orm";

const ACTIVE = ["active", "trialing"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { name } = (await req.json()) as { name?: string };
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    if (name.trim().length > 200) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });

    const leaderUserId = Number(session.user.id);

    // Se o líder já tem assinatura ativa, vincula à banda (membros herdam Pro).
    const [sub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, leaderUserId), inArray(subscriptions.status, ACTIVE)))
      .limit(1);

    const [band] = await db
      .insert(bands)
      .values({ name: name.trim(), leaderUserId, subscriptionId: sub?.id ?? null })
      .returning();

    // Líder também é membro ativo.
    await db.insert(bandMembers).values({
      bandId: band.id,
      userId: leaderUserId,
      status: "active",
      joinedAt: new Date(),
      instrument: null,
    });

    return NextResponse.json({ band }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bands]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const userId = Number(session.user.id);

    // Bandas onde é líder…
    const led = await db.select().from(bands).where(eq(bands.leaderUserId, userId));
    // …ou membro ativo.
    const memberRows = await db
      .select({ band: bands })
      .from(bandMembers)
      .innerJoin(bands, eq(bandMembers.bandId, bands.id))
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active")));

    const map = new Map<number, typeof bands.$inferSelect>();
    for (const b of led) map.set(b.id, b);
    for (const r of memberRows) map.set(r.band.id, r.band);

    const list = Array.from(map.values()).sort((a, b) => b.id - a.id);
    return NextResponse.json({
      bands: list.map((b) => ({ ...b, isLeader: b.leaderUserId === userId })),
    });
  } catch (err) {
    console.error("[GET /api/bands]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
