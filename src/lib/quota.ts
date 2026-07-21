/**
 * Quota de separação de áudio (ADR-BTS-001).
 *
 * Limites públicos por tier (o usuário sabe o que compra — decisão de
 * transparência de 18/07/2026): Free 3, Pro 20, ProBand 40 por ciclo.
 *
 * Janela de contagem:
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
 * Início da janela de cota do usuário: ciclo da assinatura ativa, ou o
 * aniversário mensal da conta como fallback (free/freeband/sem ciclo).
 */
async function quotaWindowStart(userId: number): Promise<Date> {
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
    return sub.currentPeriodStart;
  }

  const [u] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const created = u?.createdAt ?? new Date();
  return monthlyAnniversaryStart(created);
}

/** Quantas separações o usuário já disparou na janela atual (exclui failed). */
export async function uploadsThisMonth(userId: number): Promise<number> {
  const windowStart = await quotaWindowStart(userId);
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

/** Retorna { allowed, used, limit } para o usuário. */
export async function checkUploadQuota(userId: number, role?: string) {
  const limit = monthlyLimitForRole(role);
  const windowStart = await quotaWindowStart(userId);
  const used = await uploadsSince(userId, windowStart);
  return { allowed: used < limit, used, limit };
}
