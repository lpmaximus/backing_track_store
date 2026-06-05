import Link from "next/link";
import songs from "@/data/songs.json";

const GENRES = ["Todos", ...Array.from(new Set(songs.map((s) => s.genre)))];

const genreColors: Record<string, string> = {
  Rock: "#ef4444",
  "Bossa Nova": "#10b981",
  Samba: "#f59e0b",
  Pop: "#8b5cf6",
  MPB: "#3b82f6",
  Jazz: "#f97316",
  Forró: "#ec4899",
  Funk: "#14b8a6",
};

function GenreBadge({ genre }: { genre: string }) {
  const color = genreColors[genre] ?? "#888";
  return (
    <span
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
    >
      {genre}
    </span>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; genre?: string }>;
}) {
  const params = await searchParams;
  const q = params?.q?.toLowerCase() ?? "";
  const genre = params?.genre ?? "Todos";

  const filtered = songs.filter((s) => {
    const matchGenre = genre === "Todos" || s.genre === genre;
    const matchQ =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q);
    return matchGenre && matchQ;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        className="sticky top-0 z-50"
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span style={{ color: "var(--accent)" }} className="text-2xl font-black tracking-tight">
              🎸 BackingTrack
            </span>
            <span style={{ color: "var(--muted)" }} className="text-sm font-medium hidden sm:block">
              .store
            </span>
          </Link>
          <Link
            href="/admin"
            style={{ color: "var(--muted)", fontSize: 13 }}
            className="hover:opacity-70 transition-opacity"
          >
            Admin
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
          borderBottom: "1px solid var(--border)",
        }}
        className="py-12 px-4"
      >
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-black mb-2" style={{ color: "var(--text)" }}>
            Bases + Cifras para Músicos
          </h1>
          <p style={{ color: "var(--muted)" }} className="text-lg mb-8">
            Toque, ensaie e se apresente com backing tracks profissionais
          </p>

          {/* Search */}
          <form method="GET" className="flex gap-2 max-w-lg mx-auto">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Buscar música ou artista..."
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none focus:border-amber-500 transition-colors"
            />
            <input type="hidden" name="genre" value={genre} />
            <button
              type="submit"
              style={{ background: "var(--accent)", color: "#000" }}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Genre filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {GENRES.map((g) => (
            <Link
              key={g}
              href={`/?genre=${g}${q ? `&q=${q}` : ""}`}
              style={{
                background: g === genre ? "var(--accent)" : "var(--surface2)",
                color: g === genre ? "#000" : "var(--text)",
                border: `1px solid ${g === genre ? "var(--accent)" : "var(--border)"}`,
              }}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
            >
              {g}
            </Link>
          ))}
        </div>

        {/* Stats */}
        <p style={{ color: "var(--muted)" }} className="text-sm mb-4">
          {filtered.length} {filtered.length === 1 ? "música" : "músicas"} encontradas
        </p>

        {/* Song grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: "var(--muted)" }} className="text-lg">
              Nenhuma música encontrada.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((song) => (
              <Link
                key={song.id}
                href={`/song/${song.slug}`}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
                className="rounded-xl p-4 flex flex-col gap-3 hover:border-amber-500/50 transition-all group no-underline"
              >
                {/* Thumb placeholder */}
                <div
                  style={{
                    background: "var(--surface2)",
                    borderRadius: 8,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 36 }}>
                    {song.audioFile ? "🎵" : "🎸"}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      style={{ color: "var(--text)" }}
                      className="font-bold text-base leading-tight group-hover:text-amber-400 transition-colors"
                    >
                      {song.title}
                    </h3>
                    <GenreBadge genre={song.genre} />
                  </div>
                  <p style={{ color: "var(--muted)" }} className="text-sm">
                    {song.artist}
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-auto">
                  <span
                    style={{
                      background: "var(--surface2)",
                      color: "var(--muted)",
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Tom: {song.key}
                  </span>
                  <span
                    style={{
                      background: "var(--surface2)",
                      color: "var(--muted)",
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    {song.bpm} BPM
                  </span>
                  {song.audioFile && (
                    <span
                      style={{
                        marginLeft: "auto",
                        background: "#10b98122",
                        color: "#10b981",
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 4,
                        border: "1px solid #10b98133",
                      }}
                    >
                      ▶ Base
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}
        className="text-center text-sm py-6 mt-8"
      >
        © 2026 BackingTrack.store — Para músicos, por músicos
      </footer>
    </div>
  );
}
