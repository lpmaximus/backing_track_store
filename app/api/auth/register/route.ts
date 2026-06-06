import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
    if (password.length < 8)  return NextResponse.json({ error: "Senha minima: 8 caracteres" }, { status: 400 });

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, name: name ?? null, passwordHash, provider: "credentials", role: "free" });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
