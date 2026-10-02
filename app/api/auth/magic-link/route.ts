import { NextRequest, NextResponse } from "next/server";
import { createMagicToken } from "@/src/lib/authTokens";
import { sendMagicLinkEmail } from "@/src/lib/authEmails";
import { mailerConfigured } from "@/src/lib/mailer";
import { siteUrl } from "@/src/lib/siteUrl";

export const runtime = "nodejs";

/**
 * POST { email, locale, callbackUrl? } → envia o link de acesso.
 *
 * Funciona para conta nova e existente (o provider "magic-link" em auth.ts cria
 * a conta Free no primeiro acesso). É a porta de entrada para quem está no
 * navegador do Instagram/TikTok, onde o login do Google é bloqueado.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, locale, callbackUrl } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    if (!mailerConfigured()) return NextResponse.json({ error: "mail_unavailable" }, { status: 503 });

    const lang = locale === "en" ? "en" : "pt";
    const path = lang === "en" ? "/en/sign-in" : "/entrar";
    const url = new URL(`${siteUrl()}${path}`);
    url.searchParams.set("magic", createMagicToken(e));
    // Só caminho relativo do próprio site — nunca um redirect aberto.
    if (typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      url.searchParams.set("callbackUrl", callbackUrl);
    }
    await sendMagicLinkEmail(lang, e, url.toString());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/magic-link]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
