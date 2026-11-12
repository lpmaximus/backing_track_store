import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { getCommunityData } from "@/src/lib/community";
import { COUNTRY_POS } from "@/src/lib/worldMap";
import WorldMap from "./WorldMap";
import CommunityWall from "./CommunityWall";

/**
 * Faixa "Comunidade" da home: mapa de países (dados reais) + mural moderado
 * com o recado fixo do fundador + formulário "De onde você toca?".
 * É prova social, não o herói: fica abaixo dos dois caminhos do hero.
 */
const MIN_COUNTRIES_FOR_COUNT = 3;

export default async function CommunitySection({ locale }: { locale: Locale }) {
  const t = await getTranslations("community");
  const [{ countries, posts }, session] = await Promise.all([getCommunityData(), auth().catch(() => null)]);

  const names = new Intl.DisplayNames([locale], { type: "region" });
  const nameOf = (c: string) => {
    try { return names.of(c) ?? c; } catch { return c; }
  };

  const title = countries.length >= MIN_COUNTRIES_FOR_COUNT
    ? t("titleCount", { count: countries.length })
    : t("titleFallback");

  // Lista de países para o <select> do formulário, já traduzida e ordenada.
  const collator = new Intl.Collator(locale);
  const countryOptions = Object.keys(COUNTRY_POS)
    .map((code) => ({ code, name: nameOf(code) }))
    .sort((a, b) => collator.compare(a.name, b.name));

  return (
    <section id="comunidade" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
      <div className="kicker">{t("kicker")}</div>
      <h2 style={{ fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)" }}>
        {title}
      </h2>
      <p style={{ color: "var(--muted)", fontSize: 15.5, marginTop: 14, maxWidth: 620, lineHeight: 1.7 }}>
        {t("subtitle")}
      </p>

      <div style={{ marginTop: 36, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 18, padding: "clamp(12px, 3vw, 32px)" }}>
        <WorldMap countries={countries} label={t("mapAria")} />
        {countries.length > 0 && (
          <ul aria-label={t("kicker")} style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {countries.map((c) => nameOf(c)).sort(collator.compare).map((n) => (
              <li key={n} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 12px" }}>
                {n}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CommunityWall
        locale={locale}
        countries={countries}
        posts={posts.map((p) => ({ ...p, countryName: p.country ? nameOf(p.country) : null }))}
        countryOptions={countryOptions}
        loggedIn={Boolean(session?.user)}
        defaultName={session?.user?.name?.split(" ")[0] ?? ""}
      />
    </section>
  );
}
