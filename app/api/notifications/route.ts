/**
 * GET /api/notifications  (Área do Usuário)
 *
 * Lista as mensagens do usuário logado (mais recentes primeiro) + contagem de
 * não lidas. Usado pela página /conta e pelo badge do UserMenu.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listNotifications, countUnread } from "@/src/lib/notifications";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = Number(session.user.id);

  try {
    const [items, unread] = await Promise.all([
      listNotifications(userId),
      countUnread(userId),
    ]);
    return NextResponse.json({ items, unread });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
