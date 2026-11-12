/**
 * POST /api/community/posts — deixa um recado no mural da home.
 *
 * Fácil de propósito: não exige conta (se houver sessão, o recado fica ligado
 * ao usuário). Todo recado entra como `pending` e só aparece depois de
 * aprovado em /admin/mural.
 *
 * Anti-spam sem captcha: campo-isca (`website`), tempo mínimo de preenchimento
 * e limite diário por hash de IP.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, wallPosts } from "@/src/db";
import {
  WALL_LIMITS,
  countryFromHeaders,
  ipHashFromHeaders,
  normalizeCountry,
} from "@/src/lib/community";
import { mailerConfigured, sendMail } from "@/src/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // Colapsa espaços e tira caracteres de controle; React já escapa o HTML.
  return v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Robô: preencheu a isca ou enviou rápido demais. Responde "ok" para não
  // ensinar o robô a contornar — e não grava nada.
  const filledMs = Number(body.filledMs);
  if (body.website || !Number.isFinite(filledMs) || filledMs < WALL_LIMITS.minFillMs) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const name = clean(body.name, WALL_LIMITS.name);
  const city = clean(body.city, WALL_LIMITS.city) || null;
  // Conteúdo mantém quebras simples de linha? Não: o card é curto, uma linha só.
  const content = clean(body.content, WALL_LIMITS.contentMax);
  const country = normalizeCountry(body.country) ?? countryFromHeaders(req.headers);
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 5) : null;

  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });
  if (content.length < WALL_LIMITS.contentMin) return NextResponse.json({ error: "content" }, { status: 400 });

  const ipHash = ipHashFromHeaders(req.headers);
  if (ipHash) {
    try {
      const since = new Date(Date.now() - 24 * 3600_000);
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(wallPosts)
        .where(and(eq(wallPosts.ipHash, ipHash), gte(wallPosts.createdAt, since)));
      if (n >= WALL_LIMITS.perIpPerDay) {
        return NextResponse.json({ error: "rate" }, { status: 429 });
      }
    } catch {
      // se a checagem falhar, segue: a moderação segura o resto
    }
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ? Number(session.user.id) : null;

  try {
    const [created] = await db
      .insert(wallPosts)
      .values({
        userId: Number.isFinite(userId) ? userId : null,
        name,
        country,
        city,
        content,
        locale,
        ipHash,
      })
      .returning({ id: wallPosts.id });

    void notifyModerator({ name, country, city, content });
    return NextResponse.json({ ok: true, id: created?.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/community/posts]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/** Avisa o moderador por e-mail (se o SMTP estiver configurado). Nunca lança. */
async function notifyModerator(p: { name: string; country: string | null; city: string | null; content: string }) {
  const to = process.env.MURAL_NOTIFY_EMAIL || process.env.MAIL_REPLY_TO || process.env.MAIL_FROM;
  if (!to || !mailerConfigured()) return;
  const where = [p.city, p.country].filter(Boolean).join(", ") || "local não informado";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://backingtrack.store";
  const text = `Novo recado aguardando moderação no mural da home.\n\n${p.name} (${where}):\n"${p.content}"\n\nModerar: ${base}/admin/mural`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  try {
    await sendMail({
      to,
      subject: `Mural: novo recado de ${p.name}`,
      text,
      html: `<p>Novo recado aguardando moderação no mural da home.</p><p><strong>${esc(p.name)}</strong> (${esc(where)}):<br>“${esc(p.content)}”</p><p><a href="${base}/admin/mural">Moderar no painel</a></p>`,
    });
  } catch (err) {
    console.error("[community] aviso ao moderador falhou", err);
  }
}
