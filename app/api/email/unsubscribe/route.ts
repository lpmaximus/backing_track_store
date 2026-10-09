/**
 * Descadastro dos e-mails de engajamento (ciclo de vida e avisos do admin).
 *
 * GET  ?t=<token>  → link do rodapé: descadastra e mostra uma confirmação.
 * POST ?t=<token>  → "List-Unsubscribe-Post: One-Click" (Gmail/Apple Mail).
 *
 * E-mails transacionais (música pronta, senha, link de acesso) continuam
 * saindo: a pessoa pediu por eles.
 */
import { NextRequest, NextResponse } from "next/server";
import { setOptOut, verifyUnsubscribeToken } from "@/src/lib/lifecycle";
import { siteUrl } from "@/src/lib/siteUrl";

export const runtime = "nodejs";

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:520px;margin:0 auto;padding:48px 24px">
<p style="font-size:18px;font-weight:800">BackingTrack<span style="color:#FF9A00">.store</span></p>
<h1 style="font-size:20px">${title}</h1>
<p>${body}</p>
<p><a href="${siteUrl()}" style="color:#E08600">backingtrack.store</a></p>
</body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handle(req: NextRequest): Promise<{ ok: boolean }> {
  const userId = verifyUnsubscribeToken(req.nextUrl.searchParams.get("t") ?? "");
  if (!userId) return { ok: false };
  await setOptOut(userId, true);
  return { ok: true };
}

export async function GET(req: NextRequest) {
  try {
    const { ok } = await handle(req);
    if (!ok) {
      return page("Link inválido · Invalid link", "Este link de descadastro não é válido. Responda qualquer e-mail nosso pedindo o descadastro.<br>This unsubscribe link isn't valid — reply to any of our emails and we'll remove you.", 400);
    }
    return page(
      "Pronto · Done",
      "Você não vai mais receber dicas e novidades. Avisos da sua conta (como música pronta) continuam chegando.<br><br>You won't get tips and news anymore. Account notices (like “song ready”) still arrive.",
    );
  } catch (err) {
    console.error("[GET /api/email/unsubscribe]", err);
    return page("Erro · Error", "Não foi possível concluir agora. Tente de novo em alguns minutos.<br>Something went wrong — please try again in a few minutes.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { ok } = await handle(req);
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  } catch (err) {
    console.error("[POST /api/email/unsubscribe]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
