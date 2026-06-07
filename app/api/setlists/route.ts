import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs } from "@/src/db";
import { eq, sql } from "drizzle-orm";

function requirePro(role?: string) {
  return role === "pro" || role === "admin";
}

// GET /api/setlists — lista as setlists do usuario logado (Pro)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!requirePro(session.user.role)) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const userId = Number(session.user.id);
    const rows = await db
      .select({
        id: setlists.id,
        name: setlists.name,
        notes: setlists.notes,
        createdAt: setlists.createdAt,
        updatedAt: setlists.updatedAt,
        songCount: sql<number>`count(${setlistSongs.id})::int`,
      })
      .from(setlists)
      .leftJoin(setlistSongs, eq(setlistSongs.setlistId, setlists.id))
      .where(eq(setlists.userId, userId))
      .groupBy(setlists.id)
      .orderBy(setlists.updatedAt);

    return NextResponse.json({ setlists: rows.reverse() });
  } catch (err) {
    console.error("[GET /api/setlists]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/setlists — cria nova setlist { name, notes? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!requirePro(session.user.role)) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { name, notes } = await req.json() as { name?: string; notes?: string };
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400 });
    if (name.trim().length > 200) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });

    const userId = Number(session.user.id);
    const [created] = await db.insert(setlists).values({
      userId,
      name: name.trim(),
      notes: notes?.trim() || null,
    }).returning();

    return NextResponse.json({ setlist: { ...created, songCount: 0 } }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
