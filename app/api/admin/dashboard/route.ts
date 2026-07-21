/**
 * GET /api/admin/dashboard
 * Visão macro do negócio para o painel /admin (estilo Power BI): usuários,
 * catálogo/áudio, cifras (moderação), consumo/financeiro e bandas — tudo em
 * uma chamada, guardada por x-admin-password (mesmo esquema dos demais
 * módulos R3 / ADR-BTS-003).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  db,
  users,
  songs,
  stems,
  subscriptions,
  processingJobs,
  bands,
  cifraReports,
  cifraEditHistory,
} from "@/src/db";
import { and, eq, gte, ne, sql, inArray, isNotNull } from "drizzle-orm";
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

    // ── Usuários ─────────────────────────────────────────────────────────
    const usersByRole = await db
      .select({ role: users.role, n: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.role);
    const roleCount = (r: string) => usersByRole.find((x) => x.role === r)?.n ?? 0;
    const totalUsers = usersByRole.reduce((acc, r) => acc + r.n, 0);

    const [blockedUsers] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(ne(users.status, "active"));

    const [newUsersMonth] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(gte(users.createdAt, monthStart));

    // ── Catálogo / Áudio ─────────────────────────────────────────────────
    const songsByModeration = await db
      .select({ status: songs.moderationStatus, n: sql<number>`count(*)::int` })
      .from(songs)
      .groupBy(songs.moderationStatus);
    const modCount = (s: string) => songsByModeration.find((x) => x.status === s)?.n ?? 0;
    const totalSongs = songsByModeration.reduce((acc, r) => acc + r.n, 0);

    const [publishedSongs] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(songs)
      .where(eq(songs.published, true));

    const [userUploads] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(songs)
      .where(eq(songs.sourceType, "user_upload"));

    const [totalStems] = await db.select({ n: sql<number>`count(*)::int` }).from(stems);

    const [failedProcessing] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(songs)
      .where(eq(songs.processingStatus, "failed"));

    // ── Cifras ───────────────────────────────────────────────────────────
    const [songsWithCifra] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(songs)
      .where(isNotNull(songs.cifraText));

    const [openReports] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cifraReports)
      .where(eq(cifraReports.status, "open"));

    const [editsMonth] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cifraEditHistory)
      .where(gte(cifraEditHistory.createdAt, monthStart));

    // ── Consumo / Financeiro (mesma lógica de /api/admin/consumo) ────────
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

    const byRole = await db
      .select({ role: users.role, n: sql<number>`count(distinct ${users.id})::int` })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(inArray(subscriptions.status, ACTIVE))
      .groupBy(users.role);
    const proCount = byRole.find((r) => r.role === "pro")?.n ?? 0;
    const probandCount = byRole.find((r) => r.role === "proband")?.n ?? 0;
    const mrr = computeMrr({ pro: proCount, proband: probandCount });

    const [delq] = await db
      .select({ n: sql<number>`count(${subscriptions.id})::int` })
      .from(subscriptions)
      .where(inArray(subscriptions.status, DELINQUENT));

    const infraCost = FIXED_INFRA_COST.storageR2 + FIXED_INFRA_COST.neon + FIXED_INFRA_COST.vercel;
    const totalCost = separationCost + infraCost;

    // ── Bandas ───────────────────────────────────────────────────────────
    const [totalBands] = await db.select({ n: sql<number>`count(*)::int` }).from(bands);

    return NextResponse.json({
      month: monthStart.toISOString().slice(0, 7),
      users: {
        total: totalUsers,
        free: roleCount("free"),
        pro: roleCount("pro"),
        proband: roleCount("proband"),
        admin: roleCount("admin"),
        blocked: blockedUsers?.n ?? 0,
        newThisMonth: newUsersMonth?.n ?? 0,
      },
      catalog: {
        totalSongs,
        published: publishedSongs?.n ?? 0,
        userUploads: userUploads?.n ?? 0,
        moderationPending: modCount("pending"),
        moderationBlocked: modCount("blocked"),
        stems: totalStems?.n ?? 0,
        processingFailed: failedProcessing?.n ?? 0,
      },
      cifras: {
        songsWithCifra: songsWithCifra?.n ?? 0,
        openReports: openReports?.n ?? 0,
        editsThisMonth: editsMonth?.n ?? 0,
      },
      finance: {
        separations,
        separationCost,
        infraCost,
        totalCost,
        activeSubscribers: { pro: proCount, proband: probandCount },
        mrr,
        delinquent: delq?.n ?? 0,
        margin: mrr - totalCost,
      },
      bands: { total: totalBands?.n ?? 0 },
    });
  } catch (err) {
    console.error("[GET /api/admin/dashboard]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
