/**
 * Quota de separação de áudio (ADR-BTS-001).
 *
 * Limites públicos por tier (o usuário sabe o que compra — decisão de
 * transparência de 18/07/2026): Free 3, Pro 20, ProBand 40 por ciclo.
 *
 * Janela de contagem:
 *  - Trial por convite com cota própria (users.trialSeparations != null):
 *    a janela é o TRIAL INTEIRO (desde trialStartedAt) e o limite é o valor
 *    do convite. É um pacote fechado de créditos: não reseta no aniversário
 *    da conta enquanto o trial durar. Ver src/lib/trials.ts.
 *  - Pro/ProBand (assinatura ativa): o ciclo da assinatura
 *    (subscriptions.currentPeriodStart).
 *  - Free/FreeBand (sem assinatura): aniversário mensal da conta
 *    (users.createdAt projetado no mês corrente) — evita reset em massa no
 *    dia 1º e é justo com quem entra no fim do mês.
 *
 * A contagem conta apenas jobs de SEPARAÇÃO na janela que NÃO sejam cache-hit
 * (cache-hit não cria job) e que NÃO estejam 'failed'. A contagem autoritativa
 * acontece no /confirm, antes de criar o job; a rota /upload faz só uma
 * checagem preventiva.
 */
import { db, processingJobs, songs, users, subscriptions } from "@/src/db";
import { and, eq, gte, ne, sql, desc } from "drizzle-orm";

export const FREE_MONTHLY_UPLOAD_LIMIT = 3; // ADR-BTS-001: isca de conversão, export completo
export const PRO_MONTHLY_UPLOAD_LIMIT = 20; // ADR-BTS-001: pacote Pro visível e aplicado
export const PROBAND_MONTHLY_UPLOAD_LIMIT = 40; // ADR-BTS-001: pacote ProBand visível e aplicado
export const ADMIN_MONTHLY_UPLOAD_LIMIT = 5000; // teto anti-abuso; admin não trava na prática

// Status de assinatura que definem "ciclo ativo" para a janela de cota.
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);

export function monthlyLimitForRole(role?: string): number {
  if (role === "admin") return ADMIN_MONTHLY_UPLOAD_LIMIT;
  if (role === "proband") return PROBAND_MONTHLY_UPLOAD_LIMIT;
  if (role === "pro") return PRO_MONTHLY_UPLOAD_LIMIT;
  return FREE_MONTHLY_UPLOAD_LIMIT;
}

/**
 * Aniversário mensal da conta: a ocorrência mais recente do dia de
 * `createdAt` em/antes de `now` (UTC). Meses curtos são "clampados" (conta
 * criada dia 31 → dia 28/30 nos meses sem dia 31).
 */
export function monthlyAnniversaryStart(createdAt: Date, now: Date = new Date()): Date {
  const day = createdAt.getUTCDate();
  const h = createdAt.getUTCHours();
  const m = createdAt.getUTCMinutes();
  const s = createdAt.getUTCSeconds();

  const clampDay = (y: number, mo: number, d: number) =>
    Math.min(d, new Date(Date.UTC(y, mo + 1, 0)).getUTCDate());

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let candidate = new Date(Date.UTC(year, month, clampDay(year, month, day), h, m, s));

  if (candidate.getTime() > now.getTime()) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    candidate = new Date(Date.UTC(year, month, clampDay(year, month, day), h, m, s));
  }
  return candidate;
}

/**
 * Janela + limite de cota do usuário, em ordem de precedência:
 *   1. trial com cota própria → desde trialStartedAt, limite do convite
 *   2. assinatura ativa       → ciclo da assinatura
 *   3. resto                  → aniversário mensal da conta
 *
 * `trialPack` avisa quem chama que o número não reseta no mês (a UI diz
 * "restantes no teste" em vez de "neste mês").
 */
async function quotaWindow(
  userId: number,
  role?: string,
): Promise<{ windowStart: Date; limit: number; trialPack: boolean }> {
  const [u] = await db
    .select({
      createdAt: users.createdAt,
      trialPlan: users.trialPlan,
      trialStartedAt: users.trialStartedAt,
      trialEndsAt: users.trialEndsAt,
      trialSeparations: users.trialSeparations,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // 1. Pacote fechado do trial. Vale só enquanto o trial está de pé: se já
  //    venceu, cai no fluxo normal (o cron/expireTrialIfDue limpa o resto).
  const trialLive =
    u?.trialPlan &&
    u.trialSeparations != null &&
    u.trialSeparations > 0 &&
    (!u.trialEndsAt || u.trialEndsAt.getTime() > Date.now());

  if (trialLive && role !== "admin") {
    return {
      windowStart: u!.trialStartedAt ?? u!.createdAt ?? new Date(0),
      limit: u!.trialSeparations!,
      trialPack: true,
    };
  }

  const limit = monthlyLimitForRole(role);

  // 2. Ciclo da assinatura paga.
  const [sub] = await db
    .select({
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (sub && ACTIVE_SUB_STATUSES.has(sub.status) && sub.currentPeriodStart) {
    return { windowStart: sub.currentPeriodStart, limit, trialPack: false };
  }

  // 3. Aniversário mensal da conta.
  const created = u?.createdAt ?? new Date();
  return { windowStart: monthlyAnniversaryStart(created), limit, trialPack: false };
}

/** Quantas separações o usuário já disparou na janela atual (exclui failed). */
export async function uploadsThisMonth(userId: number): Promise<number> {
  const { windowStart } = await quotaWindow(userId);
  return uploadsSince(userId, windowStart);
}

async function uploadsSince(userId: number, windowStart: Date): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(${processingJobs.id})::int` })
    .from(processingJobs)
    .innerJoin(songs, eq(processingJobs.songId, songs.id))
    .where(
      and(
        eq(songs.uploadedByUserId, userId),
        eq(processingJobs.stage, "separation"),
        ne(processingJobs.status, "failed"),
        gte(processingJobs.createdAt, windowStart),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Retorna { allowed, used, limit, trialPack } para o usuário.
 * `trialPack: true` = o limite é o pacote total do teste, sem reset mensal.
 */
export async function checkUploadQuota(userId: number, role?: string) {
  const { windowStart, limit, trialPack } = await quotaWindow(userId, role);
  const used = await uploadsSince(userId, windowStart);
  return { allowed: used < limit, used, limit, trialPack };
}
