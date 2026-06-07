import Link from "next/link";
import Image from "next/image";
import { db, songs as songsTable } from "@/src/db";
import { eq, ilike, or, and } from "drizzle-orm";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import AdBanner from "./components/AdBanner";

const GENRES = [
  "Todos","Rock","Pop","MPB","Bossa Nova","Samba",
  "Jazz","Funk","Forró","Gospel","Reggae","Blues",
];

const GENRE_EMOJI: Record<string, string> = {
  Rock: "🎸", Pop: "🎤", MPB: "🇧🇷", "Bossa Nova": "🎷",
  Samba: "🥁", Jazz: "🎺", Funk: "🕺", Forró: "🪗",
  Gospel: "✝️", Reggae: "🌿", Blues: "😢",
};

export default async function HomePage({
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

  const isSearch = !!(q || (genre && genre !== "Todos"));

  return (
    <>
      <SiteHeader />

      {/* BETA BANNER */}
      <div style={{ background: "var(--text)", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "10px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          flexWrap: "wrap", textAlign: "center",
        }}>
          <span style={{
            background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 800,
            letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 999, flexShrink: 0,
          }}>
            BETA
          </span>
          <p style={{ color: "#fff", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Estamos em fase de testes — <strong>ainda não vendemos planos</strong>. Explore o catálogo livre enquanto evoluímos a plataforma com você.
          </p>
        </div>
      </div>

      <main style={{ minHeight: "100vh", background: "var(--bg)" }}>

        {/* HERO */}
        {!isSearch && (
          <section className="hero-grid" style={{
            maxWidth: 1200, margin: "0 auto", padding: "72px 24px 56px",
          }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(29,185,84,0.12)", border: "1px solid rgba(29,185,84,0.3)",
                borderRadius: 500, padding: "6px 14px", marginBottom: 24,
              }}>
                <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
                  ● PARA MÚSICOS
                </span>
              </div>
              <h1 style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.95, margin: "0 0 24px", color: "var(--text)", letterSpacing: "-0.02em" }}>
                Backing<br /><span style={{ color: "var(--accent)" }}>tracks</span><br />+ cifras.
              </h1>
              <p style={{ fontSize: 20, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 36px", maxWidth: 480 }}>
                Toque, ensaie e se apresente com bases profissionais e cifras sincronizadas em tempo real.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="#catalogo" className="btn-primary" style={{ fontSize: 15, padding: "14px 32px" }}>
                  Explorar músicas
                </Link>
                <Link href="/planos" className="btn-ghost" style={{ fontSize: 15, padding: "14px 32px" }}>
                  Ver planos
                </Link>
              </div>
              <div style={{ display: "flex", gap: 32, marginTop: 40, flexWrap: "wrap" }}>
                {[
                  { label: "Músicas", value: `${songs.length}+` },
                  { label: "Gêneros",  value: "12" },
                  { label: "Acesso",   value: "Free" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text)" }}>{value}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero visual — selo BTS + waveform decorativo */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              <div style={{ position: "relative", width: "100%", maxWidth: 460, height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* waveform decorativo */}
                <div style={{ position: "absolute", inset: "40px 0", display: "flex", alignItems: "center", gap: 4, opacity: 0.4 }} aria-hidden>
                  {Array.from({ length: 64 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: `${14 + Math.abs(Math.sin(i * 0.45)) * 130}px`,
                      borderRadius: 2,
                      background: i % 7 === 0 ? "var(--accent)" : "var(--border2)",
                    }} />
                  ))}
                </div>

                {/* selo circular */}
                <div style={{
                  position: "relative", width: 232, height: 232, borderRadius: "50%",
                  background: "var(--surface)", border: "2px solid var(--text)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.12)", flexShrink: 0,
                }}>
                  <svg viewBox="0 0 232 232" width="232" height="232" style={{ position: "absolute", inset: 0 }} aria-hidden>
                    <defs>
                      <path id="heroSealPath" d="M 116,116 m -88,0 a 88,88 0 1,1 176,0 a 88,88 0 1,1 -176,0" fill="none" />
                    </defs>
                    <circle cx="116" cy="116" r="102" fill="none" stroke="#111111" strokeWidth="1.5" />
                    <text fontSize="10.5" fontWeight={700} letterSpacing="3.5" fill="#111111">
                      <textPath href="#heroSealPath" startOffset="2%">BACKING TRACK STORE • BACKING TRACK STORE •</textPath>
                    </text>
                  </svg>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.05em", color: "var(--text)" }}>★ BTS ★</div>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", color: "var(--accent)", marginTop: 6 }}>VERSÃO BETA</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* EM ALTA AGORA — destaques */}
        {!isSearch && songs.length > 0 && (
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0 }}>🔥 Em alta agora</h2>
              <Link href="#catalogo" className="footer-link" style={{ fontWeight: 600, color: "var(--text)" }}>Ver todas →</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
              {songs.slice(0, 4).map(song => (
                <Link key={song.id} href={`/song/${song.slug}`} style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
                  padding: 14, display: "flex", flexDirection: "column", gap: 14,
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s", color: "inherit",
                }} className="song-card-featured">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: "var(--surface3)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                      {song.thumbnailUrl
                        ? <Image src={song.thumbnailUrl} alt={song.artist} width={52} height={52} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                        : (GENRE_EMOJI[song.genre] ?? "🎵")
                      }
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.artist}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ background: "var(--surface3)", color: "var(--muted)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>Tom: {song.key}</span>
                      <span style={{ background: "var(--surface3)", color: "var(--muted)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>{song.bpm} BPM</span>
                    </div>
                    <span aria-hidden style={{
                      width: 30, height: 30, borderRadius: "50%", background: "var(--text)", color: "#fff",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                    }}>▶</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CATALOG */}
        <div id="catalogo" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>

          {/* Search */}
          <form method="GET" style={{ marginBottom: 24 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 14, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, maxWidth: 440 }}>
              <span style={{ color: "var(--muted)", fontSize: 16 }}>🔍</span>
              <input
                name="q" defaultValue={q} placeholder="Buscar música ou artista..."
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, padding: "12px 0" }}
              />
              {q && <Link href="/" style={{ color: "var(--muted)", fontSize: 13 }}>✕</Link>}
            </div>
          </form>

          {/* Genre pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {GENRES.map(g => (
              <Link key={g}
                href={`/?genre=${encodeURIComponent(g)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
                {g}
              </Link>
            ))}
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: "0 0 18px" }}>
            {q ? `Resultados para "${q}"` : genre !== "Todos" ? `${GENRE_EMOJI[genre] ?? ""} ${genre}` : "🔥 Em alta agora"}
          </h2>

          {/* Banner publicitário (apenas Free) */}
          <div style={{ marginBottom: 24 }}>
            <AdBanner />
          </div>

          {/* Song grid */}
          {songs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ fontSize: 16, marginBottom: 12 }}>Nenhuma música encontrada.</p>
              <Link href="/" style={{ color: "var(--accent)", fontWeight: 600 }}>Ver todas →</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {songs.map(song => (
                <Link key={song.id} href={`/song/${song.slug}`} className="song-card">
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
                        <span style={{ background: "rgba(29,185,84,0.15)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4 }}>▶ Base</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* DIFERENCIAIS */}
        {!isSearch && (
          <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 56px" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12,
            }}>
              {[
                { icon: "🎚️", title: "Qualidade profissional", text: "Áudios em alta definição" },
                { icon: "🎵", title: "Diversos estilos", text: "Rock, Pop, MPB e mais" },
                { icon: "🕒", title: "Atualizações constantes", text: "Novas músicas toda semana" },
                { icon: "📖", title: "Catálogo livre", text: "Acesso sem bloqueios no beta" },
              ].map(({ icon, title, text }) => (
                <div key={title} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "22px 24px",
                  border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border2)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</div>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PRO PROMO */}
        {!isSearch && (
          <section style={{ maxWidth: 1200, margin: "0 auto 64px", padding: "0 24px" }}>
            <div style={{
              background: "linear-gradient(135deg, #ffffff 0%, #eafbf1 100%)",
              border: "1px solid rgba(29,185,84,0.25)", borderRadius: 20, padding: "36px 44px",
              display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 32,
            }}>
              <div>
                <span className="pro-badge" style={{ display: "inline-block", marginBottom: 12 }}>PRO</span>
                <h3 style={{ fontSize: 26, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>
                  Eleve sua prática ao próximo nível
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
                  Stems por instrumento, pitch shift, loop A-B, setlist para show e modo performance.
                  <br />Trial de 7 dias grátis — sem cartão de crédito.
                </p>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ color: "var(--accent)", fontSize: 34, fontWeight: 900 }}>R$19,90</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>/mês</div>
                <Link href="/planos" className="btn-primary">Começar grátis</Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
