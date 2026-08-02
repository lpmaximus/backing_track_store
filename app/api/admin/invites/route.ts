/**
 * /api/admin/invites — convites de teste (aba /admin/convites)
 *
 * GET:  lista + funil (enviado → clicado → cadastrado → 1º uso) + estado do SMTP.
 * POST: cria convites. Dois modos, pelo campo `channel`:
 *         "email" (padrão) — envia por SMTP, um e-mail por destinatário;
 *         "link"           — não envia nada, devolve o texto pronto para o
 *                            admin colar no WhatsApp/DM.
 *
 * Auth: header x-admin-password (src/lib/adminAuth.ts), igual aos demais
 * módulos do admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { mailerConfigured } from "@/src/lib/mailer";
import {
  DEFAULT_TRIAL_DAYS,
  createAndSendInvite,
  createInviteLink,
  getDefaultTemplate,
  inviteStats,
  listInvites,
} from "@/src/lib/invites";
import type { InvitePlan } from "@/src/lib/inviteEmail";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Trava de segurança: convite é envio 1-a-1, não campanha de massa. */
const MAX_PER_REQUEST = 20;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const [items, stats, template] = await Promise.all([
      listInvites(),
      inviteStats(),
      getDefaultTemplate(),
    ]);
    return NextResponse.json({
      items,
      stats,
      template: {
        subject: template.subject,
        body: template.body,
        shareBody: template.shareBody ?? "",
      },
      smtpReady: mailerConfigured(),
      defaultDays: DEFAULT_TRIAL_DAYS,
    });
  } catch (err) {
    console.error("[GET /api/admin/invites]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const data = (await req.json()) as {
      recipients?: { email?: string; name?: string }[];
      email?: string;
      name?: string;
      plan?: string;
      days?: number;
      separations?: number | null;
      subject?: string;
      body?: string;
      sender?: string;
      channel?: string;
      message?: string;
    };

    const plan: InvitePlan = data.plan === "proband" ? "proband" : "pro";

    // ─── Modo LINK: não envia nada, devolve o texto pronto ──────────────────
    if (data.channel === "link") {
      const email = (data.email ?? "").trim().toLowerCase();
      if (email && !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: `E-mail inválido: ${email}` }, { status: 400 });
      }
      const res = await createInviteLink({
        name: data.name?.trim() || null,
        email: email || null,
        plan,
        days: data.days,
        separations: data.separations,
        message: data.message,
        sender: data.sender,
      });
      return NextResponse.json({
        ok: true,
        channel: "link",
        message: res.message,
        url: res.url,
        id: res.invite.id,
      });
    }

    const raw = data.recipients?.length
      ? data.recipients
      : [{ email: data.email, name: data.name }];

    const recipients = raw
      .map((r) => ({ email: (r.email ?? "").trim().toLowerCase(), name: (r.name ?? "").trim() }))
      .filter((r) => r.email);

    if (recipients.length === 0) {
      return NextResponse.json({ error: "Informe pelo menos um e-mail" }, { status: 400 });
    }
    if (recipients.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_PER_REQUEST} convites por envio` },
        { status: 400 },
      );
    }
    const invalid = recipients.find((r) => !EMAIL_RE.test(r.email));
    if (invalid) {
      return NextResponse.json({ error: `E-mail inválido: ${invalid.email}` }, { status: 400 });
    }

    const results = [];
    for (const r of recipients) {
      const res = await createAndSendInvite({
        email: r.email,
        name: r.name || null,
        plan,
        days: data.days,
        separations: data.separations,
        subject: data.subject,
        body: data.body,
        sender: data.sender,
      });
      results.push({ email: r.email, ok: res.ok, error: res.ok ? null : res.error });
    }

    const sent = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, sent, failed: results.length - sent, results });
  } catch (err) {
    console.error("[POST /api/admin/invites]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
