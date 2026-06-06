import { NextRequest, NextResponse } from "next/server";
import { db, songs } from "@/src/db";
import { eq, ilike, or, and } from "drizzle-orm";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const slug = searchParams.get("slug") ?? "";

  try {
    // Busca por slug único
    if (slug) {
      const [song] = await db.select().from(songs).where(eq(songs.slug, slug)).limit(1);
      if (!song) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
      return NextResponse.json(song);
    }

    // Lista com filtros opcionais
    const conditions = [eq(songs.published, true)];
    if (genre && genre !== "Todos") conditions.push(eq(songs.genre, genre));
    if (q) {
      const cond = or(ilike(songs.title, `%${q}%`), ilike(songs.artist, `%${q}%`));
      if (cond) conditions.push(cond);
    }

    const result = await db
      .select()
      .from(songs)
      .where(and(...conditions))
      .orderBy(songs.title);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/songs]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const body = await req.json();
    const [created] = await db.insert(songs).values(body).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/songs]", err);
    return NextResponse.json({ error: "Erro ao criar música" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  try {
    const body = await req.json();
    const [updated] = await db
      .update(songs)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(songs.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PUT /api/songs]", err);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  try {
    await db.delete(songs).where(eq(songs.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/songs]", err);
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 });
  }
}
