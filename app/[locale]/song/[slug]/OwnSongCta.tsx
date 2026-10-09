import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/routing";

/**
 * Chamada para a 1ª separação, abaixo do player das bases do CATÁLOGO.
 *
 * Por quê: em 09/10/2026 quem se cadastrava tocava só bases genéricas do
 * catálogo e 12 de 13 contas Free nunca separaram a própria música — que é o
 * diferencial do produto. Esta é a página em que a pessoa já viu o mixer
 * funcionando; é a hora de mostrar que dá para fazer o mesmo com a música dela.
 *
 * Server component sem estado: só aparece em música de catálogo (page.tsx decide).
 */
export default async function OwnSongCta({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "song" });
  return (
    <section style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "8px 24px 40px" }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px",
        }}
      >
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", margin: "0 0 4px" }}>{t("ownCtaTitle")}</p>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>{t("ownCtaBody")}</p>
        </div>
        <Link
          href="/upload"
          className="btn-primary"
          data-ga="own_song_cta"
          style={{ padding: "11px 22px", fontSize: 14, display: "inline-block", whiteSpace: "nowrap" }}
        >
          {t("ownCtaButton")}
        </Link>
      </div>
    </section>
  );
}
