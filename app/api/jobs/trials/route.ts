/**
 * GET /api/jobs/trials   (cron diário)
 *
 * Rebaixa para o plano de origem todo trial de convite que venceu e avisa quem
 * está a ~3 dias do fim. Sem isto, um convite de 20 dias viraria acesso Pro
 * vitalício. Redundante com a checagem no login (auth.ts): o cron pega quem não
 * loga, o login pega o caso do cron falhar.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  (mesmo padrão de /api/jobs/finalize).
 */
import { NextRequest, NextResponse } from "next/server";
import { expireDueTrials, warnEndingTrials } from "@/src/lib/trials";

export const runtime = "nodejs";

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const warned = await warnEndingTrials();
    const expired = await expireDueTrials();
    return NextResponse.json({ ok: true, warned, expired });
  } catch (err) {
    console.error("[GET /api/jobs/trials]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
