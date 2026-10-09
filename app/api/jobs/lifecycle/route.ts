/**
 * GET /api/jobs/lifecycle   (cron diário — 10:00 de Brasília)
 *
 * Envia a sequência de retenção (boas-vindas de repescagem, lembrete da 1ª
 * separação no D2, resumo da 1ª semana no D7). Regras e janelas em
 * src/lib/lifecycle.ts. Idempotente: rodar duas vezes não duplica e-mail.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>   (padrão de /api/jobs/trials)
 */
import { NextRequest, NextResponse } from "next/server";
import { runLifecycle } from "@/src/lib/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

export async function GET(req: NextRequest) {
  if (!isCron(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const result = await runLifecycle();
    console.log("[jobs/lifecycle]", JSON.stringify(result));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[jobs/lifecycle]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
