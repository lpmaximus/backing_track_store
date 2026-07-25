import { db, songs as songsTable } from "@/src/db";
import { eq, ilike, or, and } from "drizzle-orm";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import CatalogSection from "../components/CatalogSection";

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

  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <CatalogSection songs={songs} q={q} genre={genre} />
      </main>
      <SiteFooter />
    </>
  );
}
