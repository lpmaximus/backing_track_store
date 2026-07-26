import Link from "next/link";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import HeroCarousel from "./components/HeroCarousel";
import FaqSection, { type FaqItem } from "./components/FaqSection";

// FAQ da landing — perguntas de quem ainda NÃO conhece o produto.
// (O FAQ de /planos é outro: trata de cobrança, trial e cancelamento.)
const HOME_FAQ: FaqItem[] = [
  {
    q: "O que é uma backing track?",
    a: "É a música sem o seu instrumento. Você escolhe uma faixa, silencia a guitarra (ou a bateria, o baixo, o vocal…) e toca por cima do restante da banda — como se ela estivesse ensaiando com você.",
  },
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. Tudo roda no navegador, no computador ou no celular. Basta abrir a música e apertar play.",
  },
  {
    q: "Posso usar as minhas próprias músicas?",
    a: "Sim. Você envia o arquivo e a plataforma separa os instrumentos automaticamente em faixas independentes — bateria, baixo, guitarra, teclas e vocal — para você montar a mix que quiser.",
  },
  {
    q: "A cifra é confiável?",
    a: "A cifra e a letra são geradas automaticamente e sincronizadas com o áudio, então servem como um ponto de partida muito bom — mas não são perfeitas. Qualquer pessoa pode corrigir, e a correção fica salva para os próximos.",
  },
  {
    q: "Como funciona para a minha banda?",
    a: "Você cria a banda, convida os integrantes e cada um marca o instrumento que toca. Ao abrir a mesma música, cada pessoa ouve tudo menos o próprio instrumento — e as setlists de ensaio e de show ficam compartilhadas entre todos.",
  },
  {
    q: "Quanto custa?",
    a: "Estamos em beta e ainda não vendemos planos: o catálogo está livre para explorar, sem cartão de crédito. Os valores acima são a nossa previsão para o lançamento e ainda podem mudar.",
  },
];

export default function HomePage() {
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
            background: "var(--accent)", color: "#0D0D0F", fontSize: 10, fontWeight: 800,
            letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 999, flexShrink: 0,
          }}>
            BETA
          </span>
          <p style={{ color: "#fff", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Estamos em fase de testes — <strong>ainda não vendemos planos</strong>. Explore o site livremente enquanto evoluímos a plataforma com você.
          </p>
        </div>
      </div>

      <main style={{ minHeight: "100vh", background: "var(--bg)" }}>

        {/* HERO — centrado, padrão layout-6 */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 24px 64px", textAlign: "center" }}>
            <h1 style={{
              fontSize: "clamp(44px, 7vw, 88px)", fontWeight: 800, lineHeight: 1.02,
              margin: "0 0 26px", color: "var(--text)", letterSpacing: "-0.03em",
            }}>
              Toque com a banda<br />que você <span style={{ color: "var(--accent)" }}>sempre quis.</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.65, margin: "0 auto 38px", maxWidth: 600 }}>
              Backing tracks profissionais com cifra sincronizada. Silencie o seu instrumento,
              ajuste a mix e toque junto — direto no navegador.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/catalogo" className="btn-primary" style={{ fontSize: 15, padding: "16px 34px" }}>
                Explorar músicas
              </Link>
              <Link href="/como-funciona" className="btn-ghost" style={{ fontSize: 15, padding: "16px 34px" }}>
                ▶ Ver demonstração
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 16 }}>
              Grátis para começar · catálogo livre no beta · sem cartão de crédito
            </div>
            <div style={{ marginTop: 48, fontSize: 11, letterSpacing: 4, color: "var(--muted2)", fontWeight: 600 }}>
              BACKING TRACKS <span style={{ color: "var(--accent)" }}>•</span> STEMS <span style={{ color: "var(--accent)" }}>•</span> LOOPS <span style={{ color: "var(--accent)" }}>•</span> PRACTICE
            </div>

            {/* Carrossel de destaques */}
            <HeroCarousel />
          </section>

        {/* VÍDEO EM LOOP — seção escura (padrão layout-6) */}
        <section className="videosec">
            <div className="videosec-inner">
              <div>
                <div className="kicker">RECURSOS</div>
                <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08 }}>
                  Ferramentas feitas<br />para a sua música
                </h2>
                <p style={{ color: "#aaa", marginTop: 16, fontSize: 15.5, maxWidth: 440, lineHeight: 1.7 }}>
                  Veja o player em ação: mixer por instrumento, cifra sincronizada e controle
                  de velocidade — tudo direto no navegador, sem instalar nada.
                </p>
              </div>
              <div className="vframe">
                <video src="/video-hero.mp4" autoPlay muted loop playsInline />
              </div>
            </div>
          </section>

        {/* COMO FUNCIONA */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
            <div className="kicker">COMO FUNCIONA</div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)" }}>
              Da música completa<br />ao seu palco em minutos.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 44 }}>
              {[
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 15V4" /><path d="M8 8l4-4 4 4" /><path d="M4 20h16" />
                    </svg>
                  ),
                  title: "1 · Escolha ou envie",
                  text: "Explore o catálogo ou envie sua música. Bases profissionais com stems e cifra sincronizada.",
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M6 4v16M12 4v16M18 4v16" />
                      <circle cx="6" cy="14" r="2.4" fill="currentColor" stroke="none" />
                      <circle cx="12" cy="8" r="2.4" fill="currentColor" stroke="none" />
                      <circle cx="18" cy="16" r="2.4" fill="currentColor" stroke="none" />
                    </svg>
                  ),
                  title: "2 · Monte sua mix",
                  text: "Mute, solo e volume por instrumento. Mude o tom, reduza o andamento e repita os trechos difíceis.",
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 001.54.84l10-6.5a1 1 0 000-1.68l-10-6.5A1 1 0 008 5.5z" />
                    </svg>
                  ),
                  title: "3 · Toque por cima",
                  text: "Assuma o lugar do seu instrumento, monte setlists e leve a backing track para o ensaio e o palco.",
                },
              ].map(({ icon, title, text }) => (
                <div key={title} style={{
                  background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 18, padding: "34px 28px",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: "var(--text)", color: "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", marginTop: 18 }}>{title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>{text}</div>
                </div>
              ))}
            </div>
          </section>

        {/* PARA BANDAS — seção escura com mixer mock */}
        <section className="bandsec">
            <div className="bandsec-inner">
              <div>
                <div className="kicker">PARA BANDAS</div>
                <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08 }}>
                  A mesma música,<br />uma mix para cada integrante.
                </h2>
                <p style={{ color: "#aaa", marginTop: 16, fontSize: 15.5, maxWidth: 480, lineHeight: 1.7 }}>
                  Convide sua banda, compartilhe setlists e cada um abre a música ouvindo
                  tudo — menos o próprio instrumento.
                </p>
                <Link href="/bandas" className="btn-primary" style={{ marginTop: 30, background: "var(--accent)", color: "#0D0D0F" }}>
                  Criar minha banda
                </Link>
              </div>
              <div className="mixmock" aria-hidden>
                {[
                  { nm: "VOCAL", w: 70, muted: false },
                  { nm: "BATERIA", w: 86, muted: false },
                  { nm: "BAIXO", w: 78, muted: false },
                  { nm: "GUITARRA", w: 0, muted: true },
                  { nm: "TECLAS", w: 56, muted: false },
                  { nm: "OUTROS", w: 44, muted: false },
                ].map(({ nm, w, muted }) => (
                  <div className="ch" key={nm}>
                    <span className="nm">{nm}</span>
                    <span className="bar"><i style={{ width: `${w}%` }} /></span>
                    <span className="tagmute">{muted ? "MUTE" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

        {/* PLANOS — 3 cards, padrão layout-6 (assinaturas desativadas no beta) */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 96px" }}>
            <div className="kicker">PLANOS</div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)" }}>
              Comece grátis.<br />Cresça com a sua banda.
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 44 }}>
              {[
                {
                  tier: "FREE", price: "R$0", cents: "/mês", dark: false,
                  features: ["3 músicas por mês", "Player com stems", "Cifra sincronizada"],
                  cta: "Começar", href: "/entrar", disabled: false,
                },
                {
                  tier: "PRO", price: "R$29", cents: ",90/mês", dark: true,
                  features: ["20 músicas por mês", "Export de stems", "Practice mode completo", "Cifra em PDF"],
                  cta: "Em breve", href: "/planos", disabled: true,
                },
                {
                  tier: "BAND", price: "R$49", cents: ",90/mês", dark: false,
                  features: ["40 músicas por mês", "Até 6 integrantes", "Setlists compartilhadas", "Auto-mute por instrumento"],
                  cta: "Em breve", href: "/planos", disabled: true,
                },
              ].map(({ tier, price, cents, dark, features, cta, href, disabled }) => (
                <div key={tier} style={{
                  background: dark ? "var(--text)" : "var(--surface)",
                  color: dark ? "#fff" : "var(--text)",
                  border: dark ? "1px solid var(--text)" : "1px solid var(--border)",
                  borderRadius: 18, padding: 36,
                  boxShadow: dark ? "0 24px 60px rgba(13,13,15,0.25)" : "none",
                }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.15em", fontWeight: 700, color: dark ? "var(--accent)" : "var(--muted2)" }}>{tier}</div>
                  <div style={{ fontSize: 38, fontWeight: 900, marginTop: 12 }}>
                    {price}<span style={{ fontSize: 13, fontWeight: 500, color: dark ? "#aaa" : "var(--muted2)" }}>{cents}</span>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    {features.map(f => (
                      <div key={f} style={{
                        fontSize: 13, padding: "8px 0",
                        color: dark ? "#bbb" : "var(--muted)",
                        borderBottom: dark ? "1px solid #26262c" : "1px solid var(--border)",
                      }}>
                        {f}
                      </div>
                    ))}
                  </div>
                  {disabled ? (
                    <span
                      aria-disabled="true"
                      title="Em breve — ainda não vendemos planos durante o beta"
                      style={{
                        display: "block", textAlign: "center", marginTop: 24, padding: "12px 0",
                        borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "not-allowed",
                        background: dark ? "var(--accent)" : "transparent",
                        color: dark ? "#0D0D0F" : "var(--muted2)",
                        border: dark ? "none" : "1px solid var(--border2)",
                        opacity: dark ? 0.85 : 1,
                      }}
                    >
                      {cta} <span style={{ fontSize: 10, fontWeight: 800 }}>· beta</span>
                    </span>
                  ) : (
                    <Link href={href} style={{
                      display: "block", textAlign: "center", marginTop: 24, padding: "12px 0",
                      borderRadius: 8, fontWeight: 700, fontSize: 14,
                      border: "1px solid var(--border2)", color: "var(--text)",
                    }}>
                      {cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <p style={{ color: "var(--muted2)", fontSize: 12, marginTop: 18 }}>
              Estamos em beta — os planos pagos ainda não estão à venda. Valores sujeitos a ajuste no lançamento.
            </p>
          </section>

        {/* FAQ — dúvidas de quem chega pela primeira vez */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 96px" }}>
            <FaqSection
              id="faq"
              kicker="DÚVIDAS FREQUENTES"
              title="Perguntas de quem está chegando agora."
              items={HOME_FAQ}
            />
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 24 }}>
              Ficou alguma dúvida? <Link href="/contato" style={{ color: "var(--accent)", fontWeight: 600 }}>Fale com a gente</Link>.
            </p>
          </section>
      </main>

      <SiteFooter />
    </>
  );
}
