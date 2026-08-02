import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import Image from "next/image";
import type { songs as songsTable } from "@/src/db";
import AdBanner from "./AdBanner";

// Emoji por gênero — cobre os valores de `Família` usados na carga em lote
// (ver 3-SUNO/Levantamento-BackingTracks-Suno.xlsx) e os nomes legados do
// formulário do admin, que podem divergir (ex.: "Funk" vs "Funk/Soul").
// Um gênero sem entrada aqui não quebra nada — cai no fallback "🎵" do card.
export const GENRE_EMOJI: Record<string, string> = {
  Rock: "🎸", Pop: "🎤", MPB: "🇧🇷", Jazz: "🎺", Forró: "🪗", Blues: "😢",
  "Funk/Soul": "🕺", Funk: "🕺",
  "Gospel/Louvor": "✝️", Gospel: "✝️",
  "Pagode/Samba": "🥁", Samba: "🥁", "Bossa Nova": "🎷",
  Sertanejo: "🤠", Country: "🤠",
  Regional: "🎶", "World Groove": "🌍",
  Fusion: "🎷", Metal: "🤘", Disco: "🪩", "Lo-fi/Chill": "☕",
  Balada: "💫", Latin: "💃", Reggae: "🌿",
};

type SongRow = typeof songsTable.$inferSelect;

/** Catálogo completo — busca + filtro de gênero + grid de músicas.
 *  Vive na rota /catalogo (BUY-002: retirado da landing page).
 *
 *  As pills de gênero refletem `availableGenres` (gêneros com pelo menos
 *  uma música publicada, calculado pelo caller via SELECT DISTINCT) — nunca
 *  uma lista fixa. Um gênero sem música publicada simplesmente não aparece;
 *  quando a primeira música daquele gênero é publicada, a pill surge sozinha. */
export default async function CatalogSection({
  songs, q, genre, availableGenres,
}: { songs: SongRow[]; q: string; genre: string; availableGenres: string[] }) {
  const t = await getTranslations("catalog");

  // "Todos" sempre aparece primeiro; os demais, na ordem em que vieram do
  // banco (já ordenados alfabeticamente pelo caller).
  const pills = ["Todos", ...availableGenres];

  // O valor do gênero é dado (vai na URL e no banco) — só o rótulo de "Todos"
  // muda de idioma. Os demais são nomes próprios e ficam como estão.
  const genreLabel = (g: string) => (g === "Todos" ? t("allGenres") : g);

  return (
    <div id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 48px" }}>

      <div className="kicker">{t("kicker")}</div>
      <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, letterSpacing: "-1px", margin: "12px 0 26px", color: "var(--text)" }}>
        {t("heading")}
      </h2>

      {/* Search */}
      <form method="GET" style={{ marginBottom: 24 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, maxWidth: 440 }}>
          <span style={{ color: "var(--muted)", fontSize: 16 }}>🔍</span>
          <input
            name="q" defaultValue={q} placeholder={t("searchPlaceholder")}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, padding: "12px 0" }}
          />
          {q && <Link href="/catalogo" style={{ color: "var(--muted)", fontSize: 13 }}>✕</Link>}
        </div>
      </form>

      {/* Genre pills — só gêneros com música publicada (ver availableGenres) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {pills.map(g => (
          <Link key={g}
            href={{ pathname: "/catalogo", query: q ? { genre: g, q } : { genre: g } }}
            style={{
              padding: "8px 18px", borderRadius: 500, fontSize: 13, fontWeight: 600,
              border: g === genre ? "1px solid var(--text)" : "1px solid var(--border2)",
              background: g === genre ? "var(--text)" : "var(--surface)",
              color: g === genre ? "#fff" : "var(--muted)",
              display: "inline-flex", alignItems: "center", gap: 5,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
            }}
          >
            {GENRE_EMOJI[g] && <span style={{ fontSize: 14 }}>{GENRE_EMOJI[g]}</span>}
            {genreLabel(g)}
          </Link>
        ))}
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", margin: "0 0 18px" }}>
        {q ? t("resultsFor", { q }) : genre !== "Todos" ? `${GENRE_EMOJI[genre] ?? ""} ${genre}` : t("trending")}
      </h3>

      {/* Banner publicitário (apenas Free) */}
      <div style={{ marginBottom: 24 }}>
        <AdBanner />
      </div>

      {/* Song grid */}
      {songs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 16, marginBottom: 12 }}>{t("empty")}</p>
          <Link href="/catalogo" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("seeAll")}</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {songs.map(song => (
            <Link key={song.id} href={{ pathname: "/song/[slug]", params: { slug: song.slug } }} className="song-card">
              <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--surface3)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                {song.thumbnailUrl
                  ? <Image src={song.thumbnailUrl} alt={song.artist} width={56} height={56} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                  : (GENRE_EMOJI[song.genre] ?? "🎵")
                }
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {song.title}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {song.artist}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ background: "var(--surface3)", color: "var(--muted)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>{song.key}</span>
                  <span style={{ background: "var(--surface3)", color: "var(--muted)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>{song.bpm} BPM</span>
                  {song.audioUrl && (
                    <span style={{ background: "rgba(255,154,0,0.15)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>{t("hasTrack")}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
