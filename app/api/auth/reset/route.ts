import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { parseResetToken, verifyResetToken } from "@/src/lib/authTokens";

export const runtime = "nodejs";

/**
 * POST { token, password } → troca a senha.
 * Devolve o e-mail da conta para a tela já entrar com a senha nova.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }
    const parsed = parseResetToken(String(token ?? ""));
    if (!parsed) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

    const [user] = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
    if (!user || !verifyResetToken(String(token), user.passwordHash)) {
      return NextResponse.json({ error: "invalid_token" }, { status: 400 });
    }
    if (user.status === "blocked" || user.status === "banned" || user.deletionScheduledAt) {
      return NextResponse.json({ error: "blocked" }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error("[POST /api/auth/reset]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
