import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import { getPrice } from "@/src/lib/pricingIntl";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import HeroCarousel from "@/app/components/HeroCarousel";
import FaqSection, { type FaqItem } from "@/app/components/FaqSection";
import BlurredPrice from "@/app/components/BlurredPrice";

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

  // FAQ da landing — perguntas de quem ainda NÃO conhece o produto.
  // (O FAQ de /planos é outro: trata de cobrança, trial e cancelamento.)
  const HOME_FAQ: FaqItem[] = [1, 2, 3, 4, 5, 6].map((n) => ({
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
      href: "/entrar" as const,
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
            {tb("badge")}
          </span>
          <p style={{ color: "#fff", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {tb.rich("notice", { b: (chunks) => <strong>{chunks}</strong> })}
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
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/catalogo" className="btn-primary" style={{ fontSize: 15, padding: "16px 34px" }}>
                {t("ctaExplore")}
              </Link>
              <Link href="/como-funciona" className="btn-ghost" style={{ fontSize: 15, padding: "16px 34px" }}>
                {t("ctaDemo")}
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 16 }}>
              {t("heroNote")}
            </div>
            <div style={{ marginTop: 48, fontSize: 11, letterSpacing: 4, color: "var(--muted2)", fontWeight: 600 }}>
              {t("strip")}
            </div>

            {/* Carrossel de destaques */}
            <HeroCarousel />
          </section>

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 44 }}>
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
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 001.54.84l10-6.5a1 1 0 000-1.68l-10-6.5A1 1 0 008 5.5z" />
                    </svg>
                  ),
                  title: t("step3Title"),
                  text: t("step3Text"),
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
