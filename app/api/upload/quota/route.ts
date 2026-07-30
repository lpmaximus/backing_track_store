/**
 * GET /api/upload/quota  (Fase 1.5)
 * Retorna o uso da quota mensal de separações do usuário logado, para exibir
 * na tela de envio quantas já foram usadas no mês e quantas restam do pacote.
 *
 * `trialPack: true` significa que o limite é o pacote TOTAL de um teste por
 * convite (não reseta no mês) — a tela troca o texto de "do mês" para "do
 * teste" para não prometer um reset que não vai acontecer.
 *
 * Resp: { used, limit, remaining, unlimited, trialPack }
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkUploadQuota, ADMIN_MONTHLY_UPLOAD_LIMIT } from "@/src/lib/quota";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const { used, limit, trialPack } = await checkUploadQuota(userId, session.user.role);
    const remaining = Math.max(0, limit - used);
    // Só o teto de admin é anti-abuso (não é um "pacote" a exibir). Free e Pro
    // têm limite real que aparece na tela.
    const unlimited = limit >= ADMIN_MONTHLY_UPLOAD_LIMIT;

    return NextResponse.json({ used, limit, remaining, unlimited, trialPack: !!trialPack });
  } catch (err) {
    console.error("[GET /api/upload/quota]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
