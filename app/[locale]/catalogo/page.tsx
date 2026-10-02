import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { alternatesFor } from "@/src/lib/seo";
import { db, songs as songsTable } from "@/src/db";
import { eq, ilike, or, and, inArray } from "drizzle-orm";
import { ptTitlesMatchingEn } from "@/src/lib/catalogTitles";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import CatalogSection from "@/app/components/CatalogSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: alternatesFor("/catalogo", locale),
  };
}

/** Rota dedicada do catálogo (BUY-002: antes vivia embutido na landing page). */
export default async function CatalogoPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ q?: string; genre?: string }>;
}) {
  const { locale } = await routeParams;
  const params = await searchParams;
  const q     = params?.q     ?? "";
  const genre = params?.genre ?? "Todos";

  const conditions = [eq(songsTable.published, true)];
  if (genre && genre !== "Todos") conditions.push(eq(songsTable.genre, genre));
  if (q) {
    // No /en os títulos aparecem traduzidos (src/lib/catalogTitles.ts), então
    // a busca também precisa achar pelo nome em inglês ("ballad" → "Balada…").
    const enMatches = locale === "en" ? ptTitlesMatchingEn(q) : [];
    const cond = or(
      ilike(songsTable.title, `%${q}%`),
      ilike(songsTable.artist, `%${q}%`),
      ...(enMatches.length ? [inArray(songsTable.title, enMatches)] : []),
    );
    if (cond) conditions.push(cond);
  }

  const songs = await db
    .select()
    .from(songsTable)
    .where(and(...conditions))
    .orderBy(songsTable.title);

  // Gêneros das pills: só os que têm ao menos 1 música publicada — não uma
  // lista fixa no código. Independe do filtro de busca/gênero atual (senão
  // as pills sumiriam ao filtrar), só do published=true.
  const genreRows = await db
    .selectDistinct({ genre: songsTable.genre })
    .from(songsTable)
    .where(eq(songsTable.published, true));
  const availableGenres = genreRows
    .map(r => r.genre)
    .filter((g): g is string => !!g)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <CatalogSection songs={songs} q={q} genre={genre} availableGenres={availableGenres} />
      </main>
      <SiteFooter />
    </>
  );
}
