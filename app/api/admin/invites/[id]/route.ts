/**
 * PATCH /api/admin/invites/:id   { action: "resend" | "revoke" }
 *
 * Reenviar mantém o MESMO token de propósito: se a pessoa ainda tiver o
 * primeiro e-mail na caixa, os dois links continuam levando ao mesmo lugar —
 * link antigo quebrado é justamente o comportamento que faz um convite
 * legítimo parecer golpe.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { resendInvite, revokeInvite } from "@/src/lib/invites";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const { action } = (await req.json().catch(() => ({}))) as { action?: string };

    if (action === "revoke") {
      await revokeInvite(id);
      return NextResponse.json({ ok: true });
    }

    if (action === "resend") {
      const res = await resendInvite(id);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true, invite: res.invite });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    console.error("[PATCH /api/admin/invites/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
