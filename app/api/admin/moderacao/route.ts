/**
 * /api/admin/moderacao  (Fase 1.5, Frente D — moderação)
 *
 * Auth unificada com o painel (decisão 2026-07-20): aceita a senha admin
 * (x-admin-password, como os demais módulos R3) OU sessão NextAuth com
 * role 'admin' (compatibilidade com o fluxo antigo).
 *
 *   GET  → denúncias abertas + histórico recente de edições (dados que a
 *          página /admin/moderacao consumia via server component).
 *   POST → ações (body.action):
 *     - "revert": { historyId }  → reaplica o estado anterior de uma edição.
 *     - "resolveReport": { reportId, status: 'resolved'|'dismissed' }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, users, cifraEditHistory, cifraReports } from "@/src/db";
import { desc, eq } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";

async function isAuthorized(req: NextRequest): Promise<{ ok: boolean; userId: number | null }> {
  if (isAdminRequest(req)) {
    // Painel por senha: sem usuário de sessão; audita reverts como sistema.
    const session = await auth().catch(() => null);
    return { ok: true, userId: session?.user?.id ? Number(session.user.id) : null };
  }
  const session = await auth().catch(() => null);
  if (session?.user && session.user.role === "admin") return { ok: true, userId: Number(session.user.id) };
  return { ok: false, userId: null };
}

export async function GET(req: NextRequest) {
  const { ok } = await isAuthorized(req);
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const reports = await db
      .select({
        id: cifraReports.id,
        reason: cifraReports.reason,
        createdAt: cifraReports.createdAt,
        songId: songs.id,
        songTitle: songs.title,
        songSlug: songs.slug,
        reporterEmail: users.email,
      })
      .from(cifraReports)
      .innerJoin(songs, eq(cifraReports.songId, songs.id))
      .innerJoin(users, eq(cifraReports.reportedByUserId, users.id))
      .where(eq(cifraReports.status, "open"))
      .orderBy(desc(cifraReports.id))
      .limit(50);

    const history = await db
      .select({
        id: cifraEditHistory.id,
        createdAt: cifraEditHistory.createdAt,
        songId: songs.id,
        songTitle: songs.title,
        songSlug: songs.slug,
        editorEmail: users.email,
      })
      .from(cifraEditHistory)
      .innerJoin(songs, eq(cifraEditHistory.songId, songs.id))
      .innerJoin(users, eq(cifraEditHistory.userId, users.id))
      .orderBy(desc(cifraEditHistory.id))
      .limit(30);

    return NextResponse.json({
      reports: reports.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
    });
  } catch (err) {
    console.error("[GET /api/admin/moderacao]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { ok, userId } = await isAuthorized(req);
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      action?: string;
      historyId?: number;
      reportId?: number;
      status?: string;
    };

    if (body.action === "revert") {
      if (!body.historyId) return NextResponse.json({ error: "historyId obrigatório" }, { status: 400 });
      const [entry] = await db.select().from(cifraEditHistory).where(eq(cifraEditHistory.id, body.historyId)).limit(1);
      if (!entry) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

      const [song] = await db.select().from(songs).where(eq(songs.id, entry.songId)).limit(1);
      if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

      // Auditoria: registra o revert como uma nova entrada de histórico.
      // Sem sessão (painel por senha), atribui ao editor original da entrada.
      await db.insert(cifraEditHistory).values({
        songId: entry.songId,
        userId: userId ?? entry.userId,
        previousChords: song.chords ?? null,
        newChords: entry.previousChords ?? null,
        previousCifraText: song.cifraText ?? null,
        newCifraText: entry.previousCifraText ?? null,
      });

      await db
        .update(songs)
        .set({
          chords: entry.previousChords ?? null,
          cifraText: entry.previousCifraText ?? null,
          chordsStatus: "validated",
          chordsSource: "community",
          updatedAt: new Date(),
        })
        .where(eq(songs.id, entry.songId));

      return NextResponse.json({ ok: true });
    }

    if (body.action === "resolveReport") {
      if (!body.reportId || !["resolved", "dismissed"].includes(body.status ?? "")) {
        return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
      }
      await db.update(cifraReports).set({ status: body.status }).where(eq(cifraReports.id, body.reportId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/admin/moderacao]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
