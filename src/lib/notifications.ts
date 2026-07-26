/**
 * Caixa de mensagens da Área do Usuário.
 *
 * Escopo desta fase: só mensagens geradas automaticamente pelo SISTEMA
 * (música pronta, pagamento, integrante de banda). Sem broadcast/admin e sem
 * chat direto entre usuários — ver project_backingtrack_notifications na
 * memória do projeto para o racional. `type: "promo"` já existe no schema
 * para quando um aviso promocional precisar ser inserido (script/admin
 * futuro), mas nenhum gatilho automático usa esse tipo ainda.
 *
 * Toca o banco (Neon) — não importar em componentes "use client" nem no
 * middleware/edge (mesma regra de src/lib/access.ts).
 */
import { db, notifications } from "@/src/db";
import { and, desc, eq } from "drizzle-orm";

export type NotificationType = "system" | "promo" | "band";

export async function createNotification(input: {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch (err) {
    // Notificação é best-effort: nunca deve derrubar o fluxo principal
    // (webhook de separação, pagamento, convite de banda etc.).
    console.error("[createNotification]", input.type, input.title, err);
  }
}

export async function listNotifications(userId: number, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(userId: number): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return rows.length;
}

export async function markRead(userId: number, id: number) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllRead(userId: number) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
