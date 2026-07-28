/**
 * Regras de negócio dos convites de teste (aba /admin/convites).
 *
 * Funil rastreado, sem pixel de abertura:
 *   sent      → e-mail saiu do SMTP do Zoho sem erro
 *   clicked   → a pessoa abriu /convite/<token> (primeiro clique real)
 *   accepted  → autenticou e ativou o trial
 *   first use → tocou/abriu a primeira música (marcado por markFirstUse)
 *
 * "Aberto" não é rastreado de propósito: pixel invisível é um dos sinais que
 * mais aproximam um e-mail legítimo de um phishing aos olhos do filtro (e do
 * destinatário que inspeciona o código), e Gmail/Apple Mail pré-carregam ou
 * bloqueiam a imagem, o que torna o número mentiroso de qualquer forma.
 */
import { randomBytes } from "node:crypto";
import { db, invites, inviteTemplates, users } from "@/src/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { siteUrl } from "@/src/lib/siteUrl";
import { sendMail } from "@/src/lib/mailer";
import {
  DEFAULT_BODY,
  DEFAULT_SUBJECT,
  buildHtml,
  buildText,
  renderTemplate,
  type InvitePlan,
  type InviteVars,
} from "@/src/lib/inviteEmail";
import { startTrial } from "@/src/lib/trials";
import { createNotification } from "@/src/lib/notifications";

export const DEFAULT_TRIAL_DAYS = 20;
/** Quantos dias o LINK do convite continua válido (diferente do trial). */
export const INVITE_VALID_DAYS = 30;

export function newToken(): string {
  return randomBytes(24).toString("hex"); // 48 chars
}

export function inviteUrl(token: string): string {
  return `${siteUrl()}/convite/${token}`;
}

export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/convite/${token}/sair`;
}

// ─── Template ────────────────────────────────────────────────────────────────

/** Modelo padrão; cria na primeira leitura se a tabela estiver vazia. */
export async function getDefaultTemplate() {
  const [existing] = await db
    .select()
    .from(inviteTemplates)
    .where(eq(inviteTemplates.isDefault, true))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(inviteTemplates)
    .values({
      name: "Convite padrão",
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      isDefault: true,
    })
    .returning();
  return created;
}

export async function saveDefaultTemplate(subject: string, body: string) {
  const tpl = await getDefaultTemplate();
  const [updated] = await db
    .update(inviteTemplates)
    .set({ subject, body, updatedAt: new Date() })
    .where(eq(inviteTemplates.id, tpl.id))
    .returning();
  return updated;
}

// ─── Envio ───────────────────────────────────────────────────────────────────

export type CreateInviteInput = {
  email: string;
  name?: string | null;
  plan: InvitePlan;
  days?: number;
  subject?: string;
  body?: string;
  sender?: string;
};

/**
 * Cria o registro e tenta enviar. O convite é gravado ANTES do envio: se o SMTP
 * falhar, ele fica com status `failed` e a mensagem de erro visível no admin,
 * em vez de sumir.
 */
export async function createAndSendInvite(input: CreateInviteInput) {
  const email = input.email.trim().toLowerCase();
  const days = input.days && input.days > 0 ? Math.min(input.days, 90) : DEFAULT_TRIAL_DAYS;
  const sender = input.sender?.trim() || process.env.INVITE_SENDER_NAME || "Luiz Paulo";

  const tpl = await getDefaultTemplate();
  const rawSubject = input.subject?.trim() || tpl.subject;
  const rawBody = input.body?.trim() || tpl.body;

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);

  const vars: InviteVars = {
    name: input.name ?? null,
    email,
    plan: input.plan,
    days,
    link: inviteUrl(token),
    expiresAt,
    sender,
  };

  const subject = renderTemplate(rawSubject, vars);
  const bodyRendered = renderTemplate(rawBody, vars);

  const [invite] = await db
    .insert(invites)
    .values({
      email,
      name: input.name?.trim() || null,
      plan: input.plan,
      trialDays: days,
      token,
      status: "pending",
      subject,
      body: bodyRendered,
      expiresAt,
    })
    .returning();

  try {
    await sendMail({
      to: email,
      toName: input.name?.trim() || null,
      subject,
      text: buildText(rawBody, vars, unsubscribeUrl(token)),
      html: buildHtml(rawBody, vars, unsubscribeUrl(token)),
      unsubscribeUrl: unsubscribeUrl(token),
    });

    const [sent] = await db
      .update(invites)
      .set({
        status: "sent",
        sentAt: new Date(),
        sendCount: sql`${invites.sendCount} + 1`,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(invites.id, invite.id))
      .returning();
    return { invite: sent, ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createAndSendInvite]", email, message);
    const [failed] = await db
      .update(invites)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(invites.id, invite.id))
      .returning();
    return { invite: failed, ok: false as const, error: message };
  }
}

/** Reenvia um convite existente (mesmo token, para não invalidar o 1º e-mail). */
export async function resendInvite(id: number) {
  const [invite] = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
  if (!invite) return { ok: false as const, error: "Convite não encontrado" };
  if (invite.status === "accepted") return { ok: false as const, error: "Convite já foi aceito" };
  if (invite.status === "revoked") return { ok: false as const, error: "Convite revogado" };

  // Estende a validade para o reenvio fazer sentido.
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);
  const vars: InviteVars = {
    name: invite.name,
    email: invite.email,
    plan: invite.plan as InvitePlan,
    days: invite.trialDays,
    link: inviteUrl(invite.token),
    expiresAt,
    sender: process.env.INVITE_SENDER_NAME || "Luiz Paulo",
  };

  // Usa o template ATUAL e regrava o snapshot: a validade mudou no reenvio,
  // então o corpo antigo (já renderizado) estaria mentindo sobre a data.
  const tpl = await getDefaultTemplate();
  try {
    await sendMail({
      to: invite.email,
      toName: invite.name,
      subject: invite.subject,
      text: buildText(tpl.body, vars, unsubscribeUrl(invite.token)),
      html: buildHtml(tpl.body, vars, unsubscribeUrl(invite.token)),
      unsubscribeUrl: unsubscribeUrl(invite.token),
    });
    const [updated] = await db
      .update(invites)
      .set({
        status: invite.status === "clicked" ? "clicked" : "sent",
        sentAt: new Date(),
        expiresAt,
        body: renderTemplate(tpl.body, vars),
        sendCount: sql`${invites.sendCount} + 1`,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(invites.id, id))
      .returning();
    return { ok: true as const, invite: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(invites)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(invites.id, id));
    return { ok: false as const, error: message };
  }
}

export async function revokeInvite(id: number) {
  await db
    .update(invites)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(invites.id, id));
}

// ─── Rastreio ────────────────────────────────────────────────────────────────

export type InviteState =
  | { ok: true; invite: typeof invites.$inferSelect }
  | { ok: false; reason: "notfound" | "expired" | "revoked" };

export async function loadInvite(token: string): Promise<InviteState> {
  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!invite) return { ok: false, reason: "notfound" };
  if (invite.status === "revoked") return { ok: false, reason: "revoked" };
  if (invite.status !== "accepted" && invite.expiresAt.getTime() < Date.now()) {
    if (invite.status !== "expired") {
      await db.update(invites).set({ status: "expired" }).where(eq(invites.id, invite.id));
    }
    return { ok: false, reason: "expired" };
  }
  return { ok: true, invite };
}

/** Marca o primeiro clique no link. Idempotente. */
export async function markClicked(token: string) {
  await db
    .update(invites)
    .set({
      clickedAt: sql`coalesce(${invites.clickedAt}, now())`,
      status: sql`case when ${invites.status} in ('pending','sent','failed') then 'clicked' else ${invites.status} end`,
      updatedAt: new Date(),
    })
    .where(eq(invites.token, token));
}

/**
 * Aceite: liga o convite ao usuário logado e ativa o trial.
 * Idempotente — reabrir o link depois de aceito não estende nada.
 */
export async function acceptInvite(token: string, userId: number) {
  const state = await loadInvite(token);
  if (!state.ok) return { ok: false as const, reason: state.reason };
  const invite = state.invite;

  if (invite.status === "accepted") {
    return { ok: true as const, alreadyAccepted: true, trialEndsAt: invite.trialEndsAt };
  }

  const trial = await startTrial({
    userId,
    plan: invite.plan as InvitePlan,
    days: invite.trialDays,
    source: "invite",
  });

  await db
    .update(invites)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      userId,
      trialEndsAt: trial?.trialEndsAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(invites.id, invite.id));

  if (trial) {
    await createNotification({
      userId,
      type: "system",
      title: `Seu teste ${invite.plan === "proband" ? "Pro Band" : "Pro"} está ativo`,
      body: `Você tem ${invite.trialDays} dias de acesso completo. No fim do período a conta volta sozinha para o gratuito — nada é cobrado e nada renova automaticamente.`,
      link: "/conta",
    });
  }

  return { ok: true as const, alreadyAccepted: false, trialEndsAt: trial?.trialEndsAt ?? null, plan: invite.plan };
}

/**
 * Marca o "primeiro uso" do convidado. Chamado de um ponto barato do fluxo —
 * hoje, quando ele abre a página de uma música (ver app/song/[slug]).
 * Best-effort: nunca deve derrubar o fluxo principal.
 */
export async function markFirstUse(userId: number) {
  try {
    await db
      .update(invites)
      .set({ firstUseAt: new Date(), updatedAt: new Date() })
      .where(and(eq(invites.userId, userId), isNull(invites.firstUseAt)));
  } catch (err) {
    console.error("[markFirstUse]", userId, err);
  }
}

/** Descadastro pelo link do rodapé — revoga o convite e registra a recusa. */
export async function unsubscribe(token: string) {
  await db
    .update(invites)
    .set({ status: "revoked", error: "Descadastro solicitado pelo destinatário", updatedAt: new Date() })
    .where(and(eq(invites.token, token), sql`${invites.status} <> 'accepted'`));
}

// ─── Listagem para o admin ───────────────────────────────────────────────────

export async function listInvites(limit = 200) {
  return db
    .select({
      id: invites.id,
      email: invites.email,
      name: invites.name,
      plan: invites.plan,
      trialDays: invites.trialDays,
      status: invites.status,
      subject: invites.subject,
      error: invites.error,
      token: invites.token,
      sentAt: invites.sentAt,
      sendCount: invites.sendCount,
      clickedAt: invites.clickedAt,
      acceptedAt: invites.acceptedAt,
      firstUseAt: invites.firstUseAt,
      trialEndsAt: invites.trialEndsAt,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
      userRole: users.role,
    })
    .from(invites)
    .leftJoin(users, eq(invites.userId, users.id))
    .orderBy(desc(invites.createdAt))
    .limit(limit);
}

export async function inviteStats() {
  const rows = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      sent: sql<number>`count(*) filter (where ${invites.sentAt} is not null)`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${invites.status} = 'failed')`.mapWith(Number),
      clicked: sql<number>`count(*) filter (where ${invites.clickedAt} is not null)`.mapWith(Number),
      accepted: sql<number>`count(*) filter (where ${invites.acceptedAt} is not null)`.mapWith(Number),
      used: sql<number>`count(*) filter (where ${invites.firstUseAt} is not null)`.mapWith(Number),
      active: sql<number>`count(*) filter (where ${invites.trialEndsAt} > now())`.mapWith(Number),
    })
    .from(invites);
  return rows[0];
}
