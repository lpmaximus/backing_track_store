/**
 * PATCH /api/notifications/read-all  (Área do Usuário)
 * Marca todas as mensagens do usuário logado como lidas.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllRead } from "@/src/lib/notifications";

export async function PATCH(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await markAllRead(Number(session.user.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/notifications/read-all]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
