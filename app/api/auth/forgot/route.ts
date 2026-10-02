import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/src/db";
import { sql } from "drizzle-orm";
import { createResetToken } from "@/src/lib/authTokens";
import { sendResetEmail } from "@/src/lib/authEmails";
import { mailerConfigured } from "@/src/lib/mailer";
import { siteUrl } from "@/src/lib/siteUrl";

export const runtime = "nodejs";

/**
 * POST { email, locale } → envia o link de redefinir senha.
 *
 * Sempre responde 200 { ok: true }, exista a conta ou não: responder diferente
 * entregaria a quem pergunta quais e-mails têm conta (enumeração de usuários).
 * Conta Google sem senha também recebe o link — é como ela passa a ter senha.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, locale } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    if (!e || !e.includes("@")) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    if (!mailerConfigured()) return NextResponse.json({ error: "mail_unavailable" }, { status: 503 });

    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${e}`).limit(1);
    const blocked = user && (user.status === "blocked" || user.status === "banned" || user.deletionScheduledAt);

    if (user && !blocked) {
      const lang = locale === "en" ? "en" : "pt";
      const path = lang === "en" ? "/en/sign-in" : "/entrar";
      const token = createResetToken(user.id, user.passwordHash);
      const url = `${siteUrl()}${path}?reset=${encodeURIComponent(token)}`;
      await sendResetEmail(lang, user.email, url);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/forgot]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
