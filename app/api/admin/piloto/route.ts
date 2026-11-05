/**
 * GET /api/admin/piloto — painel do piloto de 90 dias (PRD-BTS-001 v3.0).
 *
 * Lê só a tabela user_activity + users + invites e devolve, por coorte
 * (convidada × orgânica): cadastros, ativados, retorno D7, retorno D30,
 * pessoas com gravação salva, o WAM das últimas 12 semanas e a leitura das
 * regras de decisão da seção 6.
 *
 * Definições (iguais às do plano, §3–4):
 *  - evento de valor = `practice_qualified` ou `take_saved`;
 *  - ativação = primeiro evento de valor do usuário (dia 0 da coorte);
 *  - D7 = evento de valor num dia entre 7 e 13 após o dia 0;
 *  - D30 = evento de valor num dia entre 30 e 37 após o dia 0;
 *  - "elegível" = a janela já fechou (senão o usuário não entra no denominador);
 *  - WAM = usuários distintos com evento de valor na semana (seg–dom, Brasília).
 * Coorte convidada = usuário vinculado a uma linha de `invites`. Admin e contas
 * de teste interno (INTERNAL_TEST_EMAILS) ficam fora de tudo.
 *
 * Auth: x-admin-password (mesmo esquema dos outros módulos do admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, users, userActivity, invites } from "@/src/db";
import { and, inArray, isNotNull, ne } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { isInternalTestEmail } from "@/src/lib/internalTest";

export const dynamic = "force-dynamic";

const VALUE_EVENTS = ["practice_qualified", "take_saved"];
const DAY = 86_400_000;
/** Brasília é UTC-3 o ano todo (sem horário de verão desde 2019). */
const TZ_OFFSET_MS = 3 * 3_600_000;

const dayIndex = (d: Date) => Math.floor((d.getTime() - TZ_OFFSET_MS) / DAY);

type CohortStats = {
  users: number;
  activated: number;
  d7Eligible: number;
  d7: number;
  d30Eligible: number;
  d30: number;
  recordedPeople: number;
};

function emptyStats(): CohortStats {
  return { users: 0, activated: 0, d7Eligible: 0, d7: 0, d30Eligible: 0, d30: 0, recordedPeople: 0 };
}

/** Regras da seção 6, lidas na coorte convidada. Leitura parcial antes do dia 90. */
function decision(s: CohortStats): { label: string; reason: string } {
  if (s.activated < 8) {
    return { label: "Reavaliar", reason: `${s.activated} ativados (regra: menos de 8 de 30 = reavaliar).` };
  }
  if (s.d7Eligible > 0 && s.d7 === 0) {
    return { label: "Reavaliar", reason: "Nenhum retorno D7 entre os ativados com a janela fechada." };
  }
  if (s.activated >= 15 && s.d7 >= 5 && s.d30 >= 3 && s.recordedPeople >= 5) {
    return {
      label: "Avançar",
      reason: "Metas numéricas batidas. Falta conferir nas entrevistas (≥ 6 de 10 usariam de novo sem incentivo).",
    };
  }
  const missing: string[] = [];
  if (s.activated < 15) missing.push(`ativados ${s.activated}/15`);
  if (s.d7 < 5) missing.push(`D7 ${s.d7}/5`);
  if (s.d30 < 3) missing.push(`D30 ${s.d30}/3`);
  if (s.recordedPeople < 5) missing.push(`gravaram ${s.recordedPeople}/5`);
  return { label: "Iterar", reason: `Faltam: ${missing.join(", ")}.` };
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const [userRows, inviteRows, valueRows] = await Promise.all([
      db
        .select({ id: users.id, email: users.email, createdAt: users.createdAt })
        .from(users)
        .where(ne(users.role, "admin")),
      db.select({ userId: invites.userId }).from(invites).where(isNotNull(invites.userId)),
      db
        .select({ userId: userActivity.userId, event: userActivity.event, createdAt: userActivity.createdAt })
        .from(userActivity)
        .where(and(inArray(userActivity.event, VALUE_EVENTS))),
    ]);

    const invited = new Set(inviteRows.map((r) => r.userId!));
    const base = new Map<number, "invited" | "organic">();
    for (const u of userRows) {
      if (isInternalTestEmail(u.email)) continue;
      base.set(u.id, invited.has(u.id) ? "invited" : "organic");
    }

    // Dias com evento de valor, por usuário; e quem gravou.
    const days = new Map<number, Set<number>>();
    const recorded = new Set<number>();
    const weekUsers = new Map<number, Map<number, "invited" | "organic">>();
    for (const r of valueRows) {
      const cohort = base.get(r.userId);
      if (!cohort) continue;
      const d = dayIndex(r.createdAt);
      if (!days.has(r.userId)) days.set(r.userId, new Set());
      days.get(r.userId)!.add(d);
      if (r.event === "take_saved") recorded.add(r.userId);
      // Semana começando na segunda: dia 0 (1970-01-01) foi quinta → +3.
      const week = Math.floor((d + 3) / 7);
      if (!weekUsers.has(week)) weekUsers.set(week, new Map());
      weekUsers.get(week)!.set(r.userId, cohort);
    }

    const today = dayIndex(new Date());
    const stats = { invited: emptyStats(), organic: emptyStats() };
    for (const [userId, cohort] of base) {
      const s = stats[cohort];
      s.users += 1;
      const ds = days.get(userId);
      if (!ds || ds.size === 0) continue;
      s.activated += 1;
      if (recorded.has(userId)) s.recordedPeople += 1;
      const d0 = Math.min(...ds);
      const has = (from: number, to: number) => [...ds].some((d) => d - d0 >= from && d - d0 <= to);
      if (today - d0 > 13) {
        s.d7Eligible += 1;
        if (has(7, 13)) s.d7 += 1;
      }
      if (today - d0 > 37) {
        s.d30Eligible += 1;
        if (has(30, 37)) s.d30 += 1;
      }
    }

    const thisWeek = Math.floor((today + 3) / 7);
    const wam = [];
    for (let w = thisWeek - 11; w <= thisWeek; w++) {
      const m = weekUsers.get(w);
      const startDay = w * 7 - 3;
      wam.push({
        weekStart: new Date(startDay * DAY + TZ_OFFSET_MS).toISOString().slice(0, 10),
        total: m?.size ?? 0,
        invited: m ? [...m.values()].filter((c) => c === "invited").length : 0,
        current: w === thisWeek,
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      cohorts: stats,
      wam,
      decision: decision(stats.invited),
      targets: { invited: 30, activated: 15, d7: 5, d30: 3, recordedPeople: 5, wamWeek12: 5, interviews: 10 },
    });
  } catch (err) {
    console.error("[GET /api/admin/piloto]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
