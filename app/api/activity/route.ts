/**
 * POST /api/activity — ingestão de eventos de produto do usuário logado.
 *
 * Body: { event: ActivityEvent, songId?: number, meta?: object }
 * Anônimo recebe 204 e nada é gravado (não é erro: a home é pública).
 *
 * Anti-ruído: um mesmo (usuário, evento, música) só conta uma vez a cada
 * DEDUPE_MINUTES — senão um play numa música em loop viraria centenas de linhas.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userActivity } from "@/src/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { isActivityEvent, track } from "@/src/lib/activity";

export const dynamic = "force-dynamic";

const DEDUPE_MINUTES = 10;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 204 });

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) return new NextResponse(null, { status: 204 });

  let body: { event?: unknown; songId?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isActivityEvent(body.event)) {
    return NextResponse.json({ error: "Evento não reconhecido" }, { status: 400 });
  }

  const songId = typeof body.songId === "number" && Number.isFinite(body.songId) ? body.songId : null;
  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : undefined;

  try {
    const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000);
    const [recent] = await db
      .select({ id: userActivity.id })
      .from(userActivity)
      .where(
        and(
          eq(userActivity.userId, userId),
          eq(userActivity.event, body.event),
          gte(userActivity.createdAt, since),
          songId === null ? sql`${userActivity.songId} is null` : eq(userActivity.songId, songId),
        ),
      )
      .orderBy(desc(userActivity.id))
      .limit(1);

    if (recent) return new NextResponse(null, { status: 204 });
  } catch {
    // se a checagem falhar, segue e grava — duplicar é melhor que perder
  }

  await track(userId, body.event, { songId, meta });
  return new NextResponse(null, { status: 204 });
}
