import type { MetadataRoute } from "next";
import { db, songs as songsTable } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { siteUrl } from "@/src/lib/siteUrl";
import { routing, htmlLang, type Locale } from "@/src/i18n/routing";
import { getPathname } from "@/src/i18n/navigation";

// Regerado a cada 1h — o catálogo muda com pouca frequência e assim
// evitamos bater no banco a cada request de robô.
export const revalidate = 3600;

/** Páginas estáticas indexáveis. Rotas que exigem login (perfil, conta,
 *  upload, setlists, compartilhadas) ficam de fora — ver app/robots.ts. */
const STATIC_ROUTES: {
  href: Parameters<typeof getPathname>[0]["href"];
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { href: "/",              priority: 1.0, changeFrequency: "weekly" },
  { href: "/catalogo",      priority: 0.9, changeFrequency: "daily" },
  { href: "/planos",        priority: 0.8, changeFrequency: "monthly" },
  { href: "/como-funciona", priority: 0.7, changeFrequency: "monthly" },
  { href: "/bandas",        priority: 0.6, changeFrequency: "monthly" },
  { href: "/sobre",         priority: 0.4, changeFrequency: "yearly" },
  { href: "/contato",       priority: 0.4, changeFrequency: "yearly" },
  { href: "/termos",        priority: 0.2, changeFrequency: "yearly" },
  { href: "/privacidade",   priority: 0.2, changeFrequency: "yearly" },
  { href: "/cookies",       priority: 0.2, changeFrequency: "yearly" },
];

/**
 * hreflang no sitemap: cada URL declara as versões equivalentes.
 * É o que evita o Google tratar /en/pricing como duplicata de /planos.
 */
function alternates(href: Parameters<typeof getPathname>[0]["href"], base: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[htmlLang[l]] = `${base}${getPathname({ href, locale: l })}`;
  }
  return { languages };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap(
    ({ href, priority, changeFrequency }) =>
      routing.locales.map((locale: Locale) => ({
        url: `${base}${getPathname({ href, locale })}`,
        lastModified: now,
        changeFrequency,
        priority,
        alternates: alternates(href, base),
      })),
  );

  // Filtros de gênero do catálogo — cada um é uma página de conteúdo
  // distinta e uma porta de entrada orgânica ("backing track de samba").
  // Vem do banco (só gêneros com música publicada), não de uma lista fixa
  // — mesma fonte de verdade das pills em CatalogSection, senão o sitemap
  // indexa páginas vazias ou perde gêneros novos do catálogo.
  let genreEntries: MetadataRoute.Sitemap = [];
  try {
    const genreRows = await db
      .selectDistinct({ genre: songsTable.genre })
      .from(songsTable)
      .where(eq(songsTable.published, true));
    const genreList = genreRows.map(r => r.genre).filter((g): g is string => !!g);

    genreEntries = genreList.flatMap(g => {
      const query = `?genre=${encodeURIComponent(g)}`;
      const languages: Record<string, string> = {};
      for (const l of routing.locales) {
        languages[htmlLang[l]] = `${base}${getPathname({ href: "/catalogo", locale: l })}${query}`;
      }
      return routing.locales.map((locale: Locale) => ({
        url: `${base}${getPathname({ href: "/catalogo", locale })}${query}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
        // O ?genre faz parte da URL indexável — o hreflang tem que carregá-lo.
        alternates: { languages },
      }));
    });
  } catch {
    genreEntries = [];
  }

  // Páginas de música publicadas. Se o banco estiver indisponível no
  // momento do build/revalidate, devolvemos só as estáticas em vez de
  // derrubar o sitemap inteiro.
  let songEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = await db
      .select({ slug: songsTable.slug, updatedAt: songsTable.updatedAt })
      .from(songsTable)
      .where(and(
        eq(songsTable.published, true),
        eq(songsTable.moderationStatus, "approved"),
      ));

    songEntries = rows.flatMap(({ slug, updatedAt }) => {
      const href = { pathname: "/song/[slug]" as const, params: { slug } };
      return routing.locales.map((locale: Locale) => ({
        url: `${base}${getPathname({ href, locale })}`,
        lastModified: updatedAt ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.8,
        // Sem isto o Google vê /song/x e /en/song/x como duplicatas.
        alternates: alternates(href, base),
      }));
    });
  } catch {
    songEntries = [];
  }

  return [...staticEntries, ...genreEntries, ...songEntries];
}
