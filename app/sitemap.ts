import type { MetadataRoute } from "next";
import { db, songs as songsTable } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { siteUrl } from "@/src/lib/siteUrl";
import { GENRES } from "@/app/components/CatalogSection";

// Regerado a cada 1h — o catálogo muda com pouca frequência e assim
// evitamos bater no banco a cada request de robô.
export const revalidate = 3600;

/** Páginas estáticas indexáveis. Rotas que exigem login (perfil, conta,
 *  upload, setlists, compartilhadas) ficam de fora — ver app/robots.ts. */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/",              priority: 1.0, changeFrequency: "weekly" },
  { path: "/catalogo",      priority: 0.9, changeFrequency: "daily" },
  { path: "/planos",        priority: 0.8, changeFrequency: "monthly" },
  { path: "/como-funciona", priority: 0.7, changeFrequency: "monthly" },
  { path: "/bandas",        priority: 0.6, changeFrequency: "monthly" },
  { path: "/sobre",         priority: 0.4, changeFrequency: "yearly" },
  { path: "/contato",       priority: 0.4, changeFrequency: "yearly" },
  { path: "/termos",        priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacidade",   priority: 0.2, changeFrequency: "yearly" },
  { path: "/cookies",       priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Filtros de gênero do catálogo — cada um é uma página de conteúdo
  // distinta e uma porta de entrada orgânica ("backing track de samba").
  const genreEntries: MetadataRoute.Sitemap = GENRES
    .filter(g => g !== "Todos")
    .map(g => ({
      url: `${base}/catalogo?genre=${encodeURIComponent(g)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

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

    songEntries = rows.map(({ slug, updatedAt }) => ({
      url: `${base}/song/${slug}`,
      lastModified: updatedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch {
    songEntries = [];
  }

  return [...staticEntries, ...genreEntries, ...songEntries];
}
