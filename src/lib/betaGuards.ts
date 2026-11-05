/**
 * Travas de custo do Open Beta (PRD-BTS-001 v3.0 §7).
 *
 * "Acesso completo não pode significar consumo ilimitado de GPU." Três travas,
 * todas aplicadas no servidor, em /api/upload (preventiva) e
 * /api/upload/confirm (autoritativa):
 *   1. duração máxima do arquivo;
 *   2. uma separação em andamento por usuário;
 *   3. orçamento mensal de separação, com e-mail em 70%, 90% e 100% e bloqueio
 *      de novos processamentos ao atingir 100%.
 *
 * As travas 1 e 2 valem só durante o Beta (para não mudar a regra dos planos
 * pagos sem decisão). A 3 vale sempre que BETA_MONTHLY_BUDGET_BRL existir:
 * um teto de gasto é proteção do caixa, não regra de plano.
 *
 * Admin não é travado pela 1 e pela 2 (curadoria do catálogo), mas CONTA no
 * orçamento — GPU é GPU, quem quer que tenha mandado.
 *
 * Toca o banco: não importar em componentes "use client" nem no middleware.
 */
import { db, processingJobs, songs } from "@/src/db";
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { betaLimits, isBetaFullAccess, BUDGET_ALERT_THRESHOLDS } from "./beta";
import { mailerConfigured, sendMail } from "./mailer";

/** Uma separação parada há mais que isso não conta como "em andamento". */
const STUCK_AFTER_MINUTES = 45;

export type GuardBlock = {
  status: number;
  body: { error: string; code: string; [k: string]: unknown };
};

function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Trava 1 — duração. O navegador mede a duração antes de enviar e manda junto
 * (`durationSec`). Sem esse número (cliente antigo, arquivo que o navegador não
 * decodifica) a trava não bloqueia: preferimos não barrar quem enviou um
 * formato legítimo a errar para o lado do bloqueio. O orçamento (trava 3)
 * continua cobrindo o pior caso.
 */
export function checkDuration(durationSec: unknown, role?: string | null): GuardBlock | null {
  if (!isBetaFullAccess() || role === "admin") return null;
  const d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) return null;
  const max = betaLimits().maxDurationSec;
  if (d <= max) return null;
  return {
    status: 413,
    body: {
      error: `No Beta, cada arquivo pode ter até ${Math.round(max / 60)} minutos.`,
      code: "beta_max_duration",
      maxDurationSec: max,
    },
  };
}

/** Trava 2 — uma separação por vez por usuário. */
export async function checkConcurrency(userId: number, role?: string | null): Promise<GuardBlock | null> {
  if (!isBetaFullAccess() || role === "admin") return null;
  const since = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(${processingJobs.id})::int` })
    .from(processingJobs)
    .innerJoin(songs, eq(processingJobs.songId, songs.id))
    .where(
      and(
        eq(songs.uploadedByUserId, userId),
        eq(processingJobs.stage, "separation"),
        inArray(processingJobs.status, ["pending", "running"]),
        gte(processingJobs.createdAt, since),
      ),
    );
  const running = row?.n ?? 0;
  const max = betaLimits().concurrentPerUser;
  if (running < max) return null;
  return {
    status: 409,
    body: {
      error: "Você já tem uma música sendo separada. Assim que ela ficar pronta, envie a próxima.",
      code: "beta_concurrent",
    },
  };
}

export type BudgetStatus = {
  month: string;
  separations: number;
  costPerSeparationBrl: number;
  spentBrl: number;
  budgetBrl: number | null;
  /** spent / budget; null quando não há teto. */
  ratio: number | null;
  blocked: boolean;
};

/** Gasto de separação no mês corrente (UTC) contra o teto. */
export async function budgetStatus(): Promise<BudgetStatus> {
  const monthStart = startOfMonthUtc();
  const [row] = await db
    .select({ n: sql<number>`count(${processingJobs.id})::int` })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.stage, "separation"),
        ne(processingJobs.status, "failed"),
        gte(processingJobs.createdAt, monthStart),
      ),
    );
  const { monthlyBudgetBrl, separationCostBrl } = betaLimits();
  const separations = row?.n ?? 0;
  const spentBrl = round2(separations * separationCostBrl);
  const ratio = monthlyBudgetBrl && monthlyBudgetBrl > 0 ? spentBrl / monthlyBudgetBrl : null;
  return {
    month: monthStart.toISOString().slice(0, 7),
    separations,
    costPerSeparationBrl: separationCostBrl,
    spentBrl,
    budgetBrl: monthlyBudgetBrl,
    ratio,
    // Bloqueia quando a PRÓXIMA separação passaria do teto.
    blocked:
      monthlyBudgetBrl != null &&
      monthlyBudgetBrl > 0 &&
      spentBrl + separationCostBrl > monthlyBudgetBrl + 1e-9,
  };
}

/** Trava 3 — orçamento. Devolve o bloqueio e o status (para o alerta depois). */
export async function checkBudget(): Promise<{ block: GuardBlock | null; status: BudgetStatus | null }> {
  try {
    const status = await budgetStatus();
    if (!status.blocked) return { block: null, status };
    return {
      block: {
        status: 503,
        body: {
          error:
            "Atingimos o limite de processamento do Beta neste mês. Seu acesso continua liberado para praticar e gravar; novas separações voltam no próximo mês.",
          code: "beta_budget",
        },
      },
      status,
    };
  } catch (err) {
    // Falha ao medir não pode derrubar o upload: registra e deixa passar.
    console.error("[betaGuards] falha ao medir orçamento", err);
    return { block: null, status: null };
  }
}

/**
 * Chamar DEPOIS de disparar uma separação. Sem estado no banco: o alerta sai
 * quando esta separação é a que cruza a faixa (antes < faixa ≤ depois). Duas
 * requisições simultâneas na mesma faixa podem mandar dois e-mails iguais —
 * aceitável para um aviso ao fundador.
 */
export async function alertBudgetCrossing(before: BudgetStatus | null): Promise<void> {
  if (!before || before.budgetBrl == null || before.budgetBrl <= 0) return;
  const afterSpent = before.spentBrl + before.costPerSeparationBrl;
  const beforeRatio = before.spentBrl / before.budgetBrl;
  const afterRatio = afterSpent / before.budgetBrl;
  const after = { ...before, separations: before.separations + 1, spentBrl: round2(afterSpent), ratio: afterRatio };
  // 100% = "a próxima já não cabe". Avisa na separação que fecha o teto, mesmo
  // que a razão fique em 98% porque o teto não é múltiplo do custo.
  if (afterSpent + before.costPerSeparationBrl > before.budgetBrl + 1e-9) {
    await notifyBudget(after, 1);
    return;
  }
  for (const th of BUDGET_ALERT_THRESHOLDS) {
    if (th >= 1) continue;
    if (beforeRatio < th && afterRatio >= th) {
      await notifyBudget(after, th);
    }
  }
}

async function notifyBudget(status: BudgetStatus, threshold: number): Promise<void> {
  try {
    if (!mailerConfigured()) return;
    const to = process.env.REPORT_TO_EMAIL || process.env.MAIL_FROM || process.env.SMTP_USER;
    if (!to) return;
    const pct = Math.round(threshold * 100);
    const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const lines = [
      `O gasto estimado de separação do Beta chegou a ${pct}% do orçamento de ${status.month}.`,
      "",
      `Separações no mês: ${status.separations}`,
      `Custo por separação usado no cálculo: ${brl(status.costPerSeparationBrl)}`,
      `Gasto estimado: ${brl(status.spentBrl)} de ${brl(status.budgetBrl ?? 0)}`,
      "",
      threshold >= 1
        ? "Novas separações estão BLOQUEADAS até o próximo mês ou até o orçamento (BETA_MONTHLY_BUDGET_BRL) ser aumentado."
        : "Nada foi bloqueado ainda. O bloqueio acontece em 100%.",
      "",
      "O custo é estimado (separações × SEPARATION_COST_BRL). Confira o billing real no Replicate.",
    ];
    await sendMail({
      to,
      subject: `[BTS Beta] Orçamento de separação em ${pct}% (${status.month})`,
      text: lines.join("\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${lines
        .map((l) => (l ? `<p style="margin:0 0 4px">${escapeHtml(l)}</p>` : "<br/>"))
        .join("")}</div>`,
    });
  } catch (err) {
    console.error("[betaGuards] falha ao enviar alerta de orçamento", err);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
