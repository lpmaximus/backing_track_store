/**
 * /api/admin/invites — convites de teste (aba /admin/convites)
 *
 * GET:  lista + funil (enviado → clicado → cadastrado → 1º uso) + estado do SMTP.
 * POST: cria e envia um ou mais convites (um e-mail por destinatário).
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
      template: { subject: template.subject, body: template.body },
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
      subject?: string;
      body?: string;
      sender?: string;
    };

    const plan: InvitePlan = data.plan === "proband" ? "proband" : "pro";

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
