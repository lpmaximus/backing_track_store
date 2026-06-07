import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, comments, users, songs } from "@/src/db";
import { eq, desc } from "drizzle-orm";

// GET /api/comments?songId=123 — qualquer pessoa pode ler (Free incluso)
export async function GET(req: NextRequest) {
  try {
    const songId = Number(req.nextUrl.searchParams.get("songId"));
    if (!songId) return NextResponse.json({ error: "songId obrigatorio" }, { status: 400 });

    const rows = await db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        userName: users.name,
        userImage: users.image,
        userRole: users.role,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.songId, songId))
      .orderBy(desc(comments.createdAt));

    return NextResponse.json({ comments: rows });
  } catch (err) {
    console.error("[GET /api/comments]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/comments — apenas usuarios Pro/admin podem escrever
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "pro" && role !== "admin") {
    return NextResponse.json({ error: "Apenas assinantes Pro podem comentar" }, { status: 403 });
  }

  try {
    const { songId, content } = await req.json() as { songId?: number; content?: string };
    if (!songId || !content?.trim()) {
      return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
    }
    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "Comentario muito longo (max 1000 caracteres)" }, { status: 400 });
    }

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Musica nao encontrada" }, { status: 404 });

    const userId = Number(session.user.id);
    const [created] = await db.insert(comments).values({
      songId,
      userId,
      content: content.trim(),
    }).returning();

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    return NextResponse.json({
      comment: {
        id: created.id,
        content: created.content,
        createdAt: created.createdAt,
        userName: user?.name ?? null,
        userImage: user?.image ?? null,
        userRole: user?.role ?? "pro",
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/comments]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
