/**
 * Comentários no repertório da banda (R2 / ADR-BTS-002).
 *   GET  → lê comentários (dono da setlist ou membro ativo da banda).
 *   POST → escreve (todo membro ativo, incluindo FreeBand — can(comment_band_setlist)).
 *
 * Difere de /api/comments (comunidade na página da música, só Pro/ProBand).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistComments, setlists, bandMembers, users } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";

type Access =
  | { kind: "notfound" }
  | { kind: "forbidden" }
  | { kind: "owner"; bandId: number | null }
  | { kind: "member"; bandId: number };

async function resolveAccess(setlistId: number, userId: number): Promise<Access> {
  const [s] = await db.select().from(setlists).where(eq(setlists.id, setlistId)).limit(1);
  if (!s) return { kind: "notfound" };
  if (s.userId === userId) return { kind: "owner", bandId: s.bandId };
  if (s.bandId) {
    const [m] = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, s.bandId), eq(bandMembers.userId, userId), eq(bandMembers.status, "active")))
      .limit(1);
    if (m) return { kind: "member", bandId: s.bandId };
  }
  return { kind: "forbidden" };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const setlistId = Number(idParam);
  if (!setlistId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const access = await resolveAccess(setlistId, userId);
  if (access.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (access.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const rows = await db
      .select({
        id: setlistComments.id,
        content: setlistComments.content,
        createdAt: setlistComments.createdAt,
        userId: setlistComments.userId,
        userName: users.name,
        userImage: users.image,
      })
      .from(setlistComments)
      .innerJoin(users, eq(setlistComments.userId, users.id))
      .where(eq(setlistComments.setlistId, setlistId))
      .orderBy(desc(setlistComments.createdAt));

    return NextResponse.json({ comments: rows });
  } catch (err) {
    console.error("[GET /api/setlists/:id/comments]", err);
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
  const access = await resolveAccess(setlistId, userId);
  if (access.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (access.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Membro da banda escreve se can(comment_band_setlist) (freeband/pro/proband/admin).
  // Dono de setlist pessoal sempre pode comentar a própria.
  if (access.kind === "member" && !roleCan(session.user.role, "comment_band_setlist", true)) {
    return NextResponse.json({ error: "Sem permissão para comentar" }, { status: 403 });
  }

  try {
    const { content } = (await req.json()) as { content?: string };
    if (!content?.trim()) return NextResponse.json({ error: "Comentário vazio" }, { status: 400 });
    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "Comentário muito longo (máx 1000 caracteres)" }, { status: 400 });
    }

    const [created] = await db
      .insert(setlistComments)
      .values({ setlistId, userId, content: content.trim() })
      .returning();

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    return NextResponse.json(
      {
        comment: {
          id: created.id,
          content: created.content,
          createdAt: created.createdAt,
          userId,
          userName: user?.name ?? null,
          userImage: user?.image ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/setlists/:id/comments]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
