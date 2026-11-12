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
import {
  isActivityEvent,
  track,
  SERVER_ONLY_EVENTS,
  PRACTICE_QUALIFY_SECONDS,
  PRACTICE_QUALIFY_INTERACTIONS,
} from "@/src/lib/activity";
import { countryFromHeaders, rememberUserCountry } from "@/src/lib/community";

export const dynamic = "force-dynamic";

const DEDUPE_MINUTES = 10;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 204 });

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) return new NextResponse(null, { status: 204 });

  // Mapa da comunidade: contas antigas ganham o país na primeira atividade
  // (só grava se ainda estiver vazio; uma query barata e best effort).
  void rememberUserCountry(userId, countryFromHeaders(req.headers));

  let body: { event?: unknown; songId?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isActivityEvent(body.event) || SERVER_ONLY_EVENTS.has(body.event)) {
    return NextResponse.json({ error: "Evento não reconhecido" }, { status: 400 });
  }

  const songId = typeof body.songId === "number" && Number.isFinite(body.songId) ? body.songId : null;
  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : undefined;

  // Progresso de prática: sem dedupe (cada aviso traz um total maior) e é
  // aqui que o servidor decide a "prática significativa" (PRD-BTS-001 §3.1).
  if (body.event === "practice_progress") {
    await handlePracticeProgress(userId, songId, meta);
    return new NextResponse(null, { status: 204 });
  }
  if (body.event === "take_started") {
    // Cada gravação iniciada é um evento — dedupe só esconderia tentativas.
    await track(userId, "take_started", { songId, meta });
    return new NextResponse(null, { status: 204 });
  }

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

/** Teto de segundos que um aviso pode declarar (4 h): corta lixo e cliente adulterado. */
const MAX_EFFECTIVE_S = 4 * 3600;

async function handlePracticeProgress(
  userId: number,
  songId: number | null,
  meta: Record<string, unknown> | undefined,
): Promise<void> {
  const sid = typeof meta?.sid === "string" ? meta.sid.slice(0, 40) : "";
  if (!sid) return;
  const effectiveS = Math.max(0, Math.min(MAX_EFFECTIVE_S, Math.round(Number(meta?.effectiveS) || 0)));
  const interactions = Math.max(0, Math.min(10_000, Math.round(Number(meta?.interactions) || 0)));
  const clean = { sid, effectiveS, interactions };

  await track(userId, "practice_progress", { songId, meta: clean });

  if (effectiveS < PRACTICE_QUALIFY_SECONDS || interactions < PRACTICE_QUALIFY_INTERACTIONS) return;

  try {
    // Uma prática significativa por sessão do player.
    const [already] = await db
      .select({ id: userActivity.id })
      .from(userActivity)
      .where(
        and(
          eq(userActivity.userId, userId),
          eq(userActivity.event, "practice_qualified"),
          sql`${userActivity.meta}->>'sid' = ${sid}`,
        ),
      )
      .limit(1);
    if (already) return;
    await track(userId, "practice_qualified", { songId, meta: clean });
  } catch (err) {
    console.error("[activity] falha ao derivar practice_qualified", err);
  }
}
