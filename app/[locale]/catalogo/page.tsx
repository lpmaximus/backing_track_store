import { db, songs as songsTable } from "@/src/db";
import { eq, ilike, or, and } from "drizzle-orm";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import CatalogSection from "@/app/components/CatalogSection";

/** Rota dedicada do catálogo (BUY-002: antes vivia embutido na landing page). */
export default async function CatalogoPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; genre?: string }>;
}) {
  const params = await searchParams;
  const q     = params?.q     ?? "";
  const genre = params?.genre ?? "Todos";

  const conditions = [eq(songsTable.published, true)];
  if (genre && genre !== "Todos") conditions.push(eq(songsTable.genre, genre));
  if (q) {
    const cond = or(ilike(songsTable.title, `%${q}%`), ilike(songsTable.artist, `%${q}%`));
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
