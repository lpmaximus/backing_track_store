/**
 * GET/PUT /api/admin/invites/template — texto padrão do convite.
 * Fica no banco (não no código) para ajustar o tom do e-mail sem deploy.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { getDefaultTemplate, saveDefaultTemplate } from "@/src/lib/invites";
import { DEFAULT_BODY, DEFAULT_SUBJECT } from "@/src/lib/inviteEmail";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const tpl = await getDefaultTemplate();
  return NextResponse.json({
    subject: tpl.subject,
    body: tpl.body,
    factorySubject: DEFAULT_SUBJECT,
    factoryBody: DEFAULT_BODY,
  });
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { subject, body } = (await req.json()) as { subject?: string; body?: string };
    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Assunto e corpo são obrigatórios" }, { status: 400 });
    }
    const tpl = await saveDefaultTemplate(subject.trim(), body.trim());
    return NextResponse.json({ ok: true, subject: tpl.subject, body: tpl.body });
  } catch (err) {
    console.error("[PUT /api/admin/invites/template]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
