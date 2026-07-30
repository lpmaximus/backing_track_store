/**
 * Trial temporário de Pro / Pro Band.
 *
 * Decisão de projeto: o trial NÃO introduz um role novo. Ele promove
 * `users.role` para pro|proband e guarda a validade em `trial_ends_at`. Assim
 * TODO o código de permissão existente (isProRole, permissions.ts, access.ts,
 * quota.ts) continua correto sem uma linha de alteração — e o risco de um
 * caminho esquecido liberando acesso vitalício some.
 *
 * O preço dessa escolha é precisar rebaixar de volta. Isso acontece em dois
 * pontos, de propósito redundantes:
 *   1. cron diário  → /api/jobs/trials  (rebaixa todo mundo vencido)
 *   2. no login/refresh do JWT → expireTrialIfDue() (garante que ninguém
 *      continue Pro caso o cron falhe)
 *
 * Toca o banco — não importar em componentes "use client" nem no middleware.
 */
import { db, users } from "@/src/db";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { createNotification } from "@/src/lib/notifications";

export type TrialPlan = "pro" | "proband";

/**
 * Inicia (ou estende) um trial. Idempotente por natureza: se a pessoa já é
 * pro/proband PAGANTE (sem trial_plan), não mexe em nada e devolve null —
 * jamais rebaixamos um assinante real por causa de um convite.
 */
export async function startTrial(input: {
  userId: number;
  plan: TrialPlan;
  days: number;
  /**
   * Cota de separações do TOTAL do período (não por mês). null/undefined =
   * usa o limite normal do plano. Ver quota.ts → quotaWindow().
   */
  separations?: number | null;
  source?: string;
}): Promise<{ trialEndsAt: Date } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) return null;

  // Assinante pagante ou admin: não faz sentido dar trial nem tocar no role.
  const isPayingOrAdmin =
    (user.role === "pro" || user.role === "proband" || user.role === "admin") && !user.trialPlan;
  if (isPayingOrAdmin) return null;

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      role: input.plan,
      trialPlan: input.plan,
      // Trial NOVO reinicia a data; extensão de um trial em curso preserva a
      // original. Importa porque quota.ts conta o pacote de separações a partir
      // daqui: manter a data de um trial antigo faria o consumo passado
      // "comer" a cota do convite novo.
      trialStartedAt: user.trialPlan ? (user.trialStartedAt ?? now) : now,
      trialEndsAt,
      // Só grava o role de origem na primeira vez, para não "salvar" o role
      // do próprio trial como destino do rebaixamento.
      trialPreviousRole: user.trialPreviousRole ?? (user.trialPlan ? "free" : user.role),
      trialSource: input.source ?? "invite",
      trialSeparations:
        input.separations != null && input.separations > 0 ? input.separations : null,
      updatedAt: now,
    })
    .where(eq(users.id, input.userId));

  return { trialEndsAt };
}

/** Rebaixa um usuário específico se o trial dele já venceu. */
export async function expireTrialIfDue(userId: number): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.trialEndsAt || !user.trialPlan) return false;
  if (user.trialEndsAt.getTime() > Date.now()) return false;
  await downgrade(user.id, user.trialPreviousRole ?? "free");
  return true;
}

async function downgrade(userId: number, toRole: string) {
  await db
    .update(users)
    .set({
      role: toRole,
      trialPlan: null,
      trialEndsAt: null,
      trialPreviousRole: null,
      // Zera a cota do pacote: sem isso o ex-trial levaria o limite do convite
      // para a vida de free/assinante.
      trialSeparations: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Rebaixa todos os trials vencidos. Usado pelo cron /api/jobs/trials.
 * Devolve quantos foram rebaixados.
 */
export async function expireDueTrials(): Promise<number> {
  const due = await db
    .select({ id: users.id, previous: users.trialPreviousRole })
    .from(users)
    .where(
      and(
        isNotNull(users.trialPlan),
        isNotNull(users.trialEndsAt),
        lte(users.trialEndsAt, new Date()),
      ),
    );

  for (const u of due) {
    await downgrade(u.id, u.previous ?? "free");
    await createNotification({
      userId: u.id,
      type: "system",
      title: "Seu período de teste terminou",
      body: "Sua conta voltou para o plano gratuito. Nada foi cobrado. Se quiser continuar com os recursos Pro, é só assinar quando fizer sentido.",
      link: "/planos",
    });
  }

  return due.length;
}

/**
 * Avisa quem está a 3 dias do fim (também chamado pelo cron). Usa a própria
 * caixa de mensagens do site — não dispara e-mail, para não virar régua de
 * cobrança agressiva.
 *
 * A janela é fechada (entre 2 e 3 dias restantes) justamente para o cron
 * diário disparar o aviso UMA vez só, sem precisar de flag no banco.
 */
export async function warnEndingTrials(): Promise<number> {
  const day = 24 * 60 * 60 * 1000;
  const inTwoDays = new Date(Date.now() + 2 * day);
  const inThreeDays = new Date(Date.now() + 3 * day);
  const rows = await db
    .select({ id: users.id, endsAt: users.trialEndsAt })
    .from(users)
    .where(
      and(
        isNotNull(users.trialPlan),
        isNotNull(users.trialEndsAt),
        lte(users.trialEndsAt, inThreeDays),
        sql`${users.trialEndsAt} > ${inTwoDays}`,
      ),
    );

  for (const r of rows) {
    await createNotification({
      userId: r.id,
      type: "system",
      title: "Seu teste termina em breve",
      body: "Faltam poucos dias do seu período de teste. Depois disso a conta volta sozinha para o plano gratuito — sem cobrança e sem renovação automática.",
      link: "/planos",
    });
  }

  return rows.length;
}
