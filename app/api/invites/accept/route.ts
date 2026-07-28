/**
 * POST /api/invites/accept   { token }
 *
 * Ativa o trial do convite para o usuário LOGADO. Exige sessão: o convite nunca
 * pede senha nem dado pessoal por conta própria — a pessoa entra pelo login
 * normal do site e só então clica em "ativar". É essa separação que faz o fluxo
 * não ter a forma de um phishing de captura de credencial.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptInvite } from "@/src/lib/invites";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: "Token ausente" }, { status: 400 });

    const res = await acceptInvite(token, Number(session.user.id));
    if (!res.ok) {
      const msg =
        res.reason === "expired"
          ? "Este convite expirou."
          : res.reason === "revoked"
            ? "Este convite foi cancelado."
            : "Convite não encontrado.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      alreadyAccepted: res.alreadyAccepted,
      trialEndsAt: res.trialEndsAt,
    });
  } catch (err) {
    console.error("[POST /api/invites/accept]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
