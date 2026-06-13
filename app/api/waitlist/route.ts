import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

async function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  // Cria a tabela na primeira chamada, sem precisar de migration
  await sql`
    CREATE TABLE IF NOT EXISTS waitlist (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  return sql;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const sql = await getDb();
    await sql`
      INSERT INTO waitlist (email) VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/waitlist]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
