/**
 * PATCH /api/notifications/:id  (Área do Usuário)
 * Marca uma mensagem específica do usuário logado como lida.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { markRead } from "@/src/lib/notifications";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const notifId = Number(id);
  if (!Number.isFinite(notifId)) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  try {
    await markRead(Number(session.user.id), notifId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/notifications/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
