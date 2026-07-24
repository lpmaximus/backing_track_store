/**
 * Acesso Pro efetivo (Fase 1.5, passo 2b).
 *
 * Fonte única da verdade para "esse usuário tem acesso Pro?". Substitui o antigo
 * `requirePro(role)` inline espalhado pelas rotas. Diferença: além do role
 * individual (pro/admin), concede acesso a quem é membro ATIVO de uma banda com
 * assinatura ATIVA (o líder paga, os membros herdam — plano Banda).
 *
 * IMPORTANTE (regra do edge): este módulo toca o banco (Neon) — NÃO importar em
 * componentes "use client" nem no middleware/auth.config. Para UI/edge, use
 * `isProRole` de src/lib/roles.ts.
 */
import { db, bandMembers, bands, subscriptions } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { isProRole, decideProAccess } from "./roles";

// Status de assinatura que concedem acesso.
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);

/**
 * Acesso Pro efetivo do usuário. Fast path sem hit no banco quando o role
 * individual já concede; só consulta bandas quando necessário.
 */
export async function hasProAccess(userId: number, role?: string | null): Promise<boolean> {
  // Beta/captação: libera a experiência Pro (mixer de stems, velocidade, pitch,
  // setlists, sem anúncios) para TODO usuário logado. A cota de uploads/mês NÃO
  // muda (é por role em checkUploadQuota), então o Free segue com 3/mês.
  // Reverter = remover a env BETA_FULL_ACCESS.
  if (process.env.BETA_FULL_ACCESS === "true" && userId) return true;
  if (isProRole(role)) return true;
  if (!userId) return false;

  const rows = await db
    .select({ subStatus: subscriptions.status })
    .from(bandMembers)
    .innerJoin(bands, eq(bandMembers.bandId, bands.id))
    .innerJoin(subscriptions, eq(bands.subscriptionId, subscriptions.id))
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active")))
    .limit(5);

  const hasActiveBandAccess = rows.some((r) => ACTIVE_SUB_STATUSES.has(r.subStatus));
  return decideProAccess({ role, hasActiveBandAccess });
}
