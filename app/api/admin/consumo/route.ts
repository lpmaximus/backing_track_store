/**
 * GET /api/admin/consumo  (R3 / ADR-BTS-003)
 * Dashboard de custo × receita do MÊS CORRENTE, em tempo real (decisão do
 * usuário 2026-07-18: acumulado ao vivo, não fechado D+1). Seis números.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, processingJobs, subscriptions, users } from "@/src/db";
import { and, eq, gte, ne, sql, inArray } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { SEPARATION_COST, FIXED_INFRA_COST, computeMrr } from "@/src/lib/pricing";

const ACTIVE = ["active", "trialing"];
const DELINQUENT = ["past_due", "unpaid"];

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const monthStart = startOfMonth();

    // Separações do mês (exclui falhas) → custo de GPU.
    const [sep] = await db
      .select({ n: sql<number>`count(${processingJobs.id})::int` })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.stage, "separation"),
          ne(processingJobs.status, "failed"),
          gte(processingJobs.createdAt, monthStart),
        ),
      );
    const separations = sep?.n ?? 0;
    const separationCost = separations * SEPARATION_COST;

    // Assinantes ativos por plano (role) → MRR.
    const byRole = await db
      .select({ role: users.role, n: sql<number>`count(distinct ${users.id})::int` })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(inArray(subscriptions.status, ACTIVE))
      .groupBy(users.role);
    const proCount = byRole.find((r) => r.role === "pro")?.n ?? 0;
    const probandCount = byRole.find((r) => r.role === "proband")?.n ?? 0;
    const mrr = computeMrr({ pro: proCount, proband: probandCount });

    // Inadimplência (assinaturas recusadas/vencidas).
    const [delq] = await db
      .select({ n: sql<number>`count(${subscriptions.id})::int` })
      .from(subscriptions)
      .where(inArray(subscriptions.status, DELINQUENT));
    const delinquent = delq?.n ?? 0;

    const infra = FIXED_INFRA_COST.storageR2 + FIXED_INFRA_COST.neon + FIXED_INFRA_COST.vercel;
    const totalCost = separationCost + infra;
    const margin = mrr - totalCost;

    return NextResponse.json({
      month: monthStart.toISOString().slice(0, 7),
      separations,
      separationCost,
      infraCost: infra,
      totalCost,
      activeSubscribers: { pro: proCount, proband: probandCount },
      mrr,
      delinquent,
      margin,
      note: `Tempo real do mês corrente. Custo de separação = R$${SEPARATION_COST.toFixed(2)}/música (confirmar no Replicate).`,
    });
  } catch (err) {
    console.error("[GET /api/admin/consumo]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
