import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { alternatesFor } from "@/src/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription") ,
    alternates: alternatesFor("/como-funciona", locale),
  };
}

export default async function ComoFuncionaPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");

  const STEPS = [1, 2, 3, 4].map((n) => ({
    number: `0${n}`,
    title: t(`step${n}Title`),
    text: t(`step${n}Text`),
  }));

  const FEATURES = [
    { icon: "🎼", title: t("f1Title"), text: t("f1Text") },
    { icon: "🎛️", title: t("f2Title"), text: t("f2Text") },
    { icon: "🤖", title: t("f3Title"), text: t("f3Text") },
    { icon: "📚", title: t("f4Title"), text: t("f4Text") },
    { icon: "🎙️", title: t("f5Title"), text: t("f5Text") },
    { icon: "🎸", title: t("f6Title"), text: t("f6Text") },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main>
        {/* HERO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 32px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,154,0,0.12)", border: "1px solid rgba(255,154,0,0.3)",
            borderRadius: 500, padding: "6px 14px", marginBottom: 24,
          }}>
            <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
              {t("kicker")}
            </span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px", color: "var(--text)", letterSpacing: "-0.02em" }}>
            {t.rich("title", {
              accent: (chunks) => <span style={{ color: "var(--accent)" }}>{chunks}</span>,
            })}
          </h1>
          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, margin: "0 auto", maxWidth: 620 }}>
            {t("subtitle")}
          </p>
        </section>

        {/* VÍDEO DE DEMONSTRAÇÃO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
          <div style={{
            borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)",
            background: "#000", boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          }}>
            <video
              controls
              preload="metadata"
              playsInline
              style={{ display: "block", width: "100%", height: "auto" }}
            >
              <source src="/video-demo.mp4" type="video/mp4" />
              {t("videoFallback")}
            </video>
          </div>
        </section>

        {/* PASSOS */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 56px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {STEPS.map(({ number, title, text }) => (
              <div key={number} style={{
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
                padding: "24px 22px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 10 }}>
                  {number}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>{title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RECURSOS */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 20px", textAlign: "center" }}>
            {t("featuresTitle")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {FEATURES.map(({ icon, title, text }) => (
              <div key={title} style={{
                display: "flex", gap: 14, padding: "22px 24px",
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)", marginBottom: 5 }}>{title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NOTA SOBRE IA E DIREITOS */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
          <div style={{ background: "var(--surface2)", borderRadius: 16, padding: "22px 26px" }}>
            <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.75, margin: 0 }}>
              {t.rich("disclaimer", {
                link: (chunks) => (
                  <Link href="/termos" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <div style={{
            background: "linear-gradient(135deg, #ffffff 0%, #fff4e0 100%)",
            border: "1px solid rgba(255,154,0,0.25)", borderRadius: 20, padding: "36px 44px",
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>
              {t("ctaTitle")}
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 14.5, margin: "0 0 20px" }}>
              {t("ctaText")}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/catalogo" className="btn-primary">{t("ctaExplore")}</Link>
              <span className="btn-ghost" style={{ cursor: "default", opacity: 0.6 }}>{t("ctaPlans")}</span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
