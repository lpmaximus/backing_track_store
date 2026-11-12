/**
 * Comunidade na home — mapa "De onde você toca" + mural moderado.
 *
 * Regras (decisões do Luiz, 2026-11-12):
 *  - O mapa mostra só PAÍSES, sem contagem de pessoas.
 *  - Os pontos vêm de dados reais: país das contas (users.country) e país dos
 *    recados aprovados no mural. Nada é semeado à mão.
 *  - Escrever no mural tem que ser fácil (não exige conta), mas nada aparece
 *    sem aprovação em /admin/mural.
 */
import { createHash } from "crypto";
import { unstable_cache } from "next/cache";
import { and, desc, eq, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";
import { db, users, wallPosts } from "@/src/db";
import { internalTestEmailsOrUndefined } from "@/src/lib/internalTest";

export const WALL_LIMITS = {
  name: 40,
  city: 60,
  contentMin: 3,
  contentMax: 280,
  /** Recados por IP (hash) a cada 24 h — anti-spam simples. */
  perIpPerDay: 3,
  /** Formulário enviado em menos que isso = robô. */
  minFillMs: 2500,
} as const;

/** Quantos recados aprovados a home mostra. */
export const WALL_PUBLIC_LIMIT = 12;

export type PublicWallPost = {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  content: string;
  createdAt: string;
};

export type CommunityData = {
  countries: string[];
  posts: PublicWallPost[];
};

const ISO2 = /^[A-Z]{2}$/;

/** Normaliza um código de país vindo de header ou formulário. "XX"/"T1" (Tor) viram null. */
export function normalizeCountry(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  if (!ISO2.test(c) || c === "XX" || c === "ZZ") return null;
  return c;
}

/** País do visitante segundo o edge (Vercel/Cloudflare). */
export function countryFromHeaders(h: Headers): string | null {
  return normalizeCountry(
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country-code"),
  );
}

/** sha256(IP + segredo) — só para o limite diário; o IP não é guardado. */
export function ipHashFromHeaders(h: Headers): string | null {
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  if (!ip) return null;
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "bts-wall";
  return createHash("sha256").update(`${ip}|${secret}`).digest("hex");
}

/**
 * Grava o país da conta se ainda estiver vazio. Best effort: nunca lança.
 * Chamado no login e na ingestão de atividade, para as contas antigas
 * (criadas antes da coluna existir) aparecerem no mapa sem fazer nada.
 */
export async function rememberUserCountry(userId: number, country: string | null): Promise<void> {
  if (!country || !Number.isFinite(userId)) return;
  try {
    await db
      .update(users)
      .set({ country })
      .where(and(eq(users.id, userId), isNull(users.country)));
  } catch (err) {
    console.error("[community] falha ao gravar país", err);
  }
}

async function loadCommunity(): Promise<CommunityData> {
  try {
    const internal = internalTestEmailsOrUndefined();
    const fromUsers = await db
      .selectDistinct({ country: users.country })
      .from(users)
      .where(
        and(
          isNotNull(users.country),
          eq(users.status, "active"),
          isNull(users.deletionScheduledAt),
          ne(users.role, "admin"),
          internal ? notInArray(sql`lower(${users.email})`, internal) : undefined,
        ),
      );

    const approved = await db
      .select({
        id: wallPosts.id,
        name: wallPosts.name,
        country: wallPosts.country,
        city: wallPosts.city,
        content: wallPosts.content,
        createdAt: wallPosts.createdAt,
      })
      .from(wallPosts)
      .where(eq(wallPosts.status, "approved"))
      .orderBy(desc(wallPosts.createdAt))
      .limit(200);

    const set = new Set<string>();
    for (const r of fromUsers) if (r.country) set.add(r.country);
    for (const p of approved) if (p.country) set.add(p.country);

    return {
      countries: [...set].sort(),
      posts: approved.slice(0, WALL_PUBLIC_LIMIT).map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    // Relança: o unstable_cache não guarda erro, então uma falha passageira do
    // banco não deixa o mapa vazio por 2 minutos. Quem chama trata (abaixo).
    console.error("[community] falha ao carregar mapa/mural", err);
    throw err;
  }
}

/** Tag do cache: a moderação a invalida na hora (app/api/admin/mural). */
export const COMMUNITY_TAG = "community";

/**
 * Cache de 2 min: a home é dinâmica (lê a sessão), então sem isto seriam duas
 * queries por visita. Contas novas entram no mapa em até 2 minutos; recado
 * aprovado/recusado no /admin/mural aparece na hora (revalidateTag).
 */
const cachedCommunity = unstable_cache(loadCommunity, ["community-home-v2"], {
  revalidate: 120,
  tags: [COMMUNITY_TAG],
});

/** Sem tabela/coluna ainda (migração não rodou) ou banco fora: a home segue de pé. */
export async function getCommunityData(): Promise<CommunityData> {
  try {
    return await cachedCommunity();
  } catch {
    return { countries: [], posts: [] };
  }
}
