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

const NOTIFY_TO = "contato@l2techs.com";
const NOTIFY_FROM =
  process.env.WAITLIST_FROM || "Backing Track Store <onboarding@resend.dev>";

// Envia um aviso para o contato@ a cada novo cadastro (via Resend REST API).
// Fica silencioso se RESEND_API_KEY nao estiver configurada.
async function notify(email: string, total: number) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        reply_to: email,
        subject: `Novo cadastro na waitlist: ${email}`,
        text: `Novo interessado na Backing Track Store:\n\n${email}\n\nTotal de cadastros ate agora: ${total}`,
      }),
    });
  } catch (err) {
    console.error("[waitlist notify]", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalido." }, { status: 400 });
    }

    const sql = await getDb();
    const inserted = await sql`
      INSERT INTO waitlist (email) VALUES (${email})
      ON CONFLICT (email) DO NOTHING
      RETURNING email
    `;

    // So notifica se foi um cadastro realmente novo (nao duplicado)
    if (inserted.length > 0) {
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM waitlist`;
      await notify(email, count);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/waitlist]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// Lista os cadastros. Protegido pela senha de admin:
//   GET /api/waitlist  com header  x-admin-key: <ADMIN_PASSWORD>
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }
  try {
    const sql = await getDb();
    const rows = await sql`
      SELECT email, created_at FROM waitlist ORDER BY created_at DESC
    `;
    return NextResponse.json({ count: rows.length, emails: rows });
  } catch (err) {
    console.error("[GET /api/waitlist]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
