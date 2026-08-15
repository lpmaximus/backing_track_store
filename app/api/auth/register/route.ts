import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/src/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Mesmo pixel de app/components/TikTokPixel.tsx (conta L2techs_adv, criado
// 2026-08-15). Duplicado aqui de propósito — client component não pode
// importar de dentro de uma API route sem virar bundle desnecessário.
const TIKTOK_PIXEL_CODE = "DA05SBRC77U6N6ARQK0G";
const TIKTOK_EVENTS_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Events API (server-side) — complementa o ttq.track client-side em
 * entrar/page.tsx. Motivo: em 2026-08-15, 4 cadastros reais confirmados
 * (inclusive em aba anônima) dispararam o pixel só em "Eventos de teste",
 * nunca como dado real em "Visão geral" — o navegador sozinho não estava
 * sendo suficiente (bloqueador, delay de propagação, cookie de terceiros).
 * O event_id precisa bater com o do ttq.track pra TikTok deduplicar os dois
 * e contar 1 conversão só. Nunca lança erro pra fora — se a TikTok estiver
 * fora do ar ou o token faltar, o cadastro não pode falhar por causa disso.
 */
async function trackTikTokCompleteRegistration(opts: {
  email: string;
  eventId: string;
  ip?: string;
  userAgent?: string;
  ttp?: string;
  ttclid?: string;
  pageUrl?: string;
}) {
  const accessToken = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[tiktok-events-api] TIKTOK_EVENTS_ACCESS_TOKEN nao configurado — evento server-side nao enviado");
    return;
  }

  try {
    const testEventCode = process.env.TIKTOK_TEST_EVENT_CODE; // só setar durante teste, remover em produção
    const body = {
      event_source: "web",
      event_source_id: TIKTOK_PIXEL_CODE,
      data: [
        {
          event: "CompleteRegistration",
          event_time: Math.floor(Date.now() / 1000),
          event_id: opts.eventId,
          user: {
            email: [sha256(opts.email)],
            ...(opts.ip ? { ip: opts.ip } : {}),
            ...(opts.userAgent ? { user_agent: opts.userAgent } : {}),
            ...(opts.ttp ? { ttp: opts.ttp } : {}),
            ...(opts.ttclid ? { ttclid: opts.ttclid } : {}),
          },
          ...(opts.pageUrl ? { page: { url: opts.pageUrl } } : {}),
        },
      ],
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    };

    const res = await fetch(TIKTOK_EVENTS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.code !== 0) {
      console.error("[tiktok-events-api] resposta com erro", res.status, json);
    } else {
      // TEMP: log de sucesso pra depurar o rollout de 2026-08-15 — remover
      // depois de confirmar que o evento chega como dado real na TikTok.
      console.log("[tiktok-events-api] evento enviado com sucesso", res.status, json);
    }
  } catch (err) {
    console.error("[tiktok-events-api] falha ao enviar evento", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, eventId } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
    if (password.length < 8)  return NextResponse.json({ error: "Senha minima: 8 caracteres" }, { status: 400 });

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return NextResponse.json({ error: "Email ja cadastrado" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email, name: name ?? null, passwordHash, provider: "credentials", role: "free" });

    // TEMP: log de depuracao do rollout de 2026-08-15 — remover junto com o
    // console.log de sucesso acima assim que confirmarmos o evento na TikTok.
    console.log("[tiktok-events-api] eventId recebido no cadastro?", Boolean(eventId), eventId);

    if (eventId) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined;
      await trackTikTokCompleteRegistration({
        email,
        eventId,
        ip,
        userAgent: req.headers.get("user-agent") || undefined,
        ttp: req.cookies.get("_ttp")?.value,
        ttclid: req.cookies.get("ttclid")?.value,
        pageUrl: req.headers.get("referer") || undefined,
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
