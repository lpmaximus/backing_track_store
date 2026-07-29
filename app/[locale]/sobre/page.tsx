import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const VALUE_ICONS = ["🎧", "🤝", "⚖️", "🔒"];

export default async function SobrePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  const VALUES = VALUE_ICONS.map((icon, i) => ({
    icon,
    title: t(`v${i + 1}Title`),
    text: t(`v${i + 1}Text`),
  }));

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
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", color: "var(--text)", letterSpacing: "-0.02em" }}>
            {t("title")}
          </h1>
          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, margin: "0 auto", maxWidth: 620 }}>
            {t("intro")}
          </p>
        </section>

        {/* MISSÃO / PRODUTO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 56px" }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
            padding: "40px 44px",
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 16px" }}>
              {t("whatTitle")}
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.85, margin: "0 0 16px" }}>
              {t("whatP1")}
            </p>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              {t("whatP2")}
            </p>
          </div>
        </section>

        {/* VALORES */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 20px", textAlign: "center" }}>
            {t("valuesTitle")}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {VALUES.map(({ icon, title, text }) => (
              <div key={title} style={{
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
                padding: "24px 22px",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14,
                }}>
                  {icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>{title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* QUEM OPERA */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
          <div style={{
            border: "1px solid var(--border)", borderRadius: 20, padding: "32px 36px",
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>
              {t("operatorTitle")}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7, margin: "0 0 20px" }}>
              {t("operatorText")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/contato" className="btn-primary">{t("ctaContact")}</Link>
              <Link href="/termos" className="btn-ghost">{t("ctaTerms")}</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
