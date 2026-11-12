import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import { alternatesFor } from "@/src/lib/seo";
import { siteUrl } from "@/src/lib/siteUrl";
import { getPrice } from "@/src/lib/pricingIntl";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import HeroCarousel from "@/app/components/HeroCarousel";
import FaqSection, { type FaqItem } from "@/app/components/FaqSection";
import FreePromoBanner from "@/app/components/FreePromoBanner";
import BlurredPrice from "@/app/components/BlurredPrice";
import TrackedLink from "@/app/components/TrackedLink";
import CommunitySection from "@/app/components/community/CommunitySection";
import { isBetaFullAccess } from "@/src/lib/beta";

// Título e descrição vêm do layout (são os da marca). Aqui só o canonical:
// sem isto a home ficaria sem canonical depois de removermos o do layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor("/", locale) };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tb = await getTranslations("beta");
  const tp = await getTranslations("plans");
  // Open Beta (PRD-BTS-001): a home promete o acesso completo só quando ele
  // está de fato ligado — desligar a flag volta o texto sozinho.
  const beta = isBetaFullAccess();

  // FAQ da landing — perguntas de quem ainda NÃO conhece o produto.
  // (O FAQ de /planos é outro: trata de cobrança, trial e cancelamento.)
  // 7 e 8 respondem as perguntas que as pessoas fazem a assistentes de IA
  // ("remover guitarra de uma música", "backing track vs YouTube") — o
  // ChatGPT já é a maior fonte de visitas (GA, out/2026).
  const HOME_FAQ: FaqItem[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    q: t(`faq.q${n}`),
    a: t(`faq.a${n}`),
  }));

  // Preço vem de src/lib/pricingIntl — em inglês sai em USD.
  const freePrice = getPrice("free", "monthly", locale);
  const proPrice = getPrice("pro", "monthly", locale);
  const bandPrice = getPrice("band", "monthly", locale);

  const PLANS = [
    {
      tier: tp("free"),
      price: freePrice.formatted,
      // O Free é sempre zero — não faz sentido esconder.
      blur: false,
      dark: false,
      features: [tp("freeFeature1"), tp("freeFeature2"), tp("freeFeature3")],
      cta: tp("start"),
      // Mesma correção do header/promo: "Começar" precisa abrir a aba de
      // cadastro de /entrar, não a de login.
      href: { pathname: "/entrar", query: { tab: "cadastro" } } as const,
      disabled: false,
    },
    {
      tier: tp("pro"),
      price: proPrice.formatted,
      blur: true,
      dark: true,
      features: [tp("proFeature1"), tp("proFeature2"), tp("proFeature3"), tp("proFeature4")],
      cta: tp("soon"),
      href: "/planos" as const,
      disabled: true,
    },
    {
      tier: tp("band"),
      price: bandPrice.formatted,
      blur: true,
      dark: false,
      features: [tp("bandFeature1"), tp("bandFeature2"), tp("bandFeature3"), tp("bandFeature4")],
      cta: tp("soon"),
      href: "/planos" as const,
      disabled: true,
    },
  ];

  const MIX_CHANNELS = [
    { nm: t("mixVocal"), w: 70, muted: false },
    { nm: t("mixDrums"), w: 86, muted: false },
    { nm: t("mixBass"), w: 78, muted: false },
    { nm: t("mixGuitar"), w: 0, muted: true },
    { nm: t("mixKeys"), w: 56, muted: false },
    { nm: t("mixOther"), w: 44, muted: false },
  ];

  // Dado estruturado do produto: ajuda buscadores e assistentes de IA a
  // descrever o site corretamente (o que é, quanto custa, em que idiomas).
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "BackingTrack.store",
    url: siteUrl() + (locale === "pt" ? "" : `/${locale}`),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web browser)",
    inLanguage: ["pt-BR", "en", "es"],
    description: t("faq.a3"),
    featureList: [
      "AI stem separation (drums, bass, guitar, keys, vocals)",
      "Mute any instrument and play along",
      "Chord charts synced to the audio",
      "Tempo and key change, section loop",
      "Band setlists for rehearsal and live shows",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: locale === "pt" ? "BRL" : "USD", description: "Free plan" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Conteúdo nosso, sem input de usuário.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <SiteHeader />

      {/* BETA BANNER */}
      <div style={{ background: "var(--text)", borderBottom: "1px solid var(--border)" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          flexWrap: "wrap", textAlign: "center",
        }}>
          <span style={{
            background: "var(--accent)", color: "#0D0D0F", fontSize: 10, fontWeight: 800,
            letterSpacing: "0.1em", padding: "3px 9px", borderRadius: 999, flexShrink: 0,
          }}>
            {tb("badge")}
          </span>
          <p className="beta-notice" style={{ color: "#fff", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {tb.rich(beta ? "noticeOpen" : "notice", { b: (chunks) => <strong>{chunks}</strong> })}
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
              {t("heroTitle")}<br /><span style={{ color: "var(--accent)" }}>{t("heroTitleAccent")}</span>
            </h1>
            <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.65, margin: "0 auto 38px", maxWidth: 600 }}>
              {t("heroSubtitle")}
            </p>
            {/* Dois caminhos (Plano de Validação do MVP, PRD-BTS-001):
                quem já tem a música envia; quem só quer sentir o produto abre
                uma base do catálogo, que toca sem conta. Os dois levam ao mesmo
                centro do produto — o estúdio de prática. Out/2026: com só o
                botão do catálogo em destaque, o visitante achava que o BTS era
                um repositório de bases prontas e quase ninguém enviava música.
                Visitante sem conta que clica em "Enviar" cai na aba de
                cadastro (proxy.ts). */}
            <div className="home-paths" style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16, maxWidth: 880, margin: "0 auto", textAlign: "left",
            }}>
              <div style={{
                background: "var(--text)", color: "#fff", borderRadius: 18, padding: "26px 26px 24px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 800, color: "var(--accent)" }}>{t("pathOwnKicker")}</div>
                <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>{t("pathOwnTitle")}</div>
                <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.6, flex: 1 }}>{t("pathOwnFlow")}</div>
                <TrackedLink href="/upload" className="btn-primary" event="upload_cta_click" eventParams={{ from: "home_path_own" }}
                  style={{ fontSize: 15, padding: "14px 24px", marginTop: 8, background: "var(--accent)", color: "#0D0D0F", textAlign: "center" }}>
                  {t("ctaUpload")}
                </TrackedLink>
              </div>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 18, padding: "26px 26px 24px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", fontWeight: 800, color: "var(--muted2)" }}>{t("pathTryKicker")}</div>
                <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25, color: "var(--text)" }}>{t("pathTryTitle")}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, flex: 1 }}>{t("pathTryFlow")}</div>
                <TrackedLink href={{ pathname: "/song/[slug]", params: { slug: "classic-rock-a-120" } }} className="btn-ghost"
                  event="demo_mixer_open" eventParams={{ from: "home_path_try" }}
                  style={{ fontSize: 15, padding: "14px 24px", marginTop: 8, textAlign: "center" }}>
                  {t("ctaTry")}
                </TrackedLink>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Link href="/catalogo" style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3 }}>
                {t("ctaExplore")}
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 16 }}>
              {beta ? t("heroNoteBeta") : t("heroNote")}
            </div>
            <div style={{ marginTop: 48, fontSize: 11, letterSpacing: 4, color: "var(--muted2)", fontWeight: 600 }}>
              {t("strip")}
            </div>

            {/* Carrossel de destaques */}
            <HeroCarousel />
          </section>

        {/* PROMO DO PLANO FREE — só para visitante deslogado. Saiu do topo:
            no celular ele + o aviso de beta ocupavam a primeira tela inteira
            e a proposta do produto só aparecia depois de rolar. */}
        <FreePromoBanner />

        {/* COMUNIDADE — mapa de países (dados reais) + mural moderado.
            Prova social logo depois dos caminhos do hero (2026-11-12). */}
        <CommunitySection locale={locale} />

        {/* VÍDEO EM LOOP — seção escura (padrão layout-6) */}
        <section className="videosec">
            <div className="videosec-inner">
              <div>
                <div className="kicker">{t("featuresKicker")}</div>
                <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08 }}>
                  {t("featuresTitle")}
                </h2>
                <p style={{ color: "#aaa", marginTop: 16, fontSize: 15.5, maxWidth: 440, lineHeight: 1.7 }}>
                  {t("featuresText")}
                </p>
              </div>
              <div className="vframe">
                <video src="/video-hero.mp4" autoPlay muted loop playsInline />
              </div>
            </div>
          </section>

        {/* COMO FUNCIONA */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
            <div className="kicker">{t("howKicker")}</div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)" }}>
              {t("howTitle")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, marginTop: 44 }}>
              {[
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 15V4" /><path d="M8 8l4-4 4 4" /><path d="M4 20h16" />
                    </svg>
                  ),
                  title: t("step1Title"),
                  text: t("step1Text"),
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
                  title: t("step2Title"),
                  text: t("step2Text"),
                },
                {
                  // Gravação ganhou passo próprio: era o recurso menos
                  // descoberto e é o que sustenta a tese do piloto.
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0014 0" /><path d="M12 18v3" />
                    </svg>
                  ),
                  title: t("step3Title"),
                  text: t("step3Text"),
                },
                {
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                    </svg>
                  ),
                  title: t("step4Title"),
                  text: t("step4Text"),
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
                <div className="kicker">{t("bandsKicker")}</div>
                <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08 }}>
                  {t("bandsTitle")}
                </h2>
                <p style={{ color: "#aaa", marginTop: 16, fontSize: 15.5, maxWidth: 480, lineHeight: 1.7 }}>
                  {t("bandsText")}
                </p>
                <Link href="/bandas" className="btn-primary" style={{ marginTop: 30, background: "var(--accent)", color: "#0D0D0F" }}>
                  {t("bandsCta")}
                </Link>
              </div>
              <div className="mixmock" aria-hidden>
                {MIX_CHANNELS.map(({ nm, w, muted }) => (
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
            <div className="kicker">{t("plansKicker")}</div>
            <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)" }}>
              {t("plansTitle")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 44 }}>
              {PLANS.map(({ tier, price, blur, dark, features, cta, href, disabled }) => (
                <div key={tier} style={{
                  background: dark ? "var(--text)" : "var(--surface)",
                  color: dark ? "#fff" : "var(--text)",
                  border: dark ? "1px solid var(--text)" : "1px solid var(--border)",
                  borderRadius: 18, padding: 36,
                  boxShadow: dark ? "0 24px 60px rgba(13,13,15,0.25)" : "none",
                }}>
                  <div style={{ fontSize: 12, letterSpacing: "0.15em", fontWeight: 700, color: dark ? "var(--accent)" : "var(--muted2)" }}>{tier}</div>
                  <div style={{ fontSize: 38, fontWeight: 900, marginTop: 12 }}>
                    {blur
                      ? <BlurredPrice srLabel={tp("priceHidden")}>{price}</BlurredPrice>
                      : price}
                    <span style={{ fontSize: 13, fontWeight: 500, color: dark ? "#aaa" : "var(--muted2)" }}>{tp("perMonth")}</span>
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
                      title={tp("soonTitle")}
                      style={{
                        display: "block", textAlign: "center", marginTop: 24, padding: "12px 0",
                        borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "not-allowed",
                        background: dark ? "var(--accent)" : "transparent",
                        color: dark ? "#0D0D0F" : "var(--muted2)",
                        border: dark ? "none" : "1px solid var(--border2)",
                        opacity: dark ? 0.85 : 1,
                      }}
                    >
                      {cta}
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
              {t("plansDisclaimer")}
            </p>
          </section>

        {/* FAQ — dúvidas de quem chega pela primeira vez */}
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 96px" }}>
            <FaqSection
              id="faq"
              kicker={t("faqKicker")}
              title={t("faqTitle")}
              items={HOME_FAQ}
            />
            <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 24 }}>
              {t.rich("faqFooter", {
                link: (chunks) => (
                  <Link href="/contato" style={{ color: "var(--accent)", fontWeight: 600 }}>{chunks}</Link>
                ),
              })}
            </p>
          </section>
      </main>

      <SiteFooter />
    </>
  );
}
