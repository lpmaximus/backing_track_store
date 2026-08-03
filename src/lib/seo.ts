/**
 * Canonical + hreflang por página.
 *
 * ⚠️ Por que isto existe: no App Router, `alternates` definido no layout é
 * HERDADO por toda página que não sobrescreve o campo. O layout de [locale]
 * declarava `canonical` da HOME, e o resultado era todas as páginas do site
 * (catálogo, planos, cada música) dizendo ao Google "sou uma cópia da home" —
 * bug confirmado em produção em 03/08/2026, com /song/classic-rock-a-120
 * servindo `<link rel="canonical" href="https://www.backingtrack.store/">`.
 * Isso derruba as páginas internas do índice.
 *
 * Regra: o layout NÃO declara alternates; cada página pública declara o seu
 * com `alternatesFor(href, locale)`. Página privada (conta, upload, setlists —
 * bloqueadas no robots.ts) simplesmente não declara: ausência de canonical é
 * inofensiva, canonical errado não.
 */
import type { Metadata } from "next";
import { routing, htmlLang, defaultLocale, type Locale } from "@/src/i18n/routing";
import { getPathname } from "@/src/i18n/navigation";
import { siteUrl } from "@/src/lib/siteUrl";

type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * Monta canonical da própria página + hreflang de todos os idiomas.
 * `x-default` aponta para o idioma padrão (pt), que é a versão sem prefixo.
 */
export function alternatesFor(href: Href, locale: Locale): NonNullable<Metadata["alternates"]> {
  const base = siteUrl();

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[htmlLang[l]] = `${base}${getPathname({ href, locale: l })}`;
  }
  languages["x-default"] = `${base}${getPathname({ href, locale: defaultLocale })}`;

  return {
    canonical: `${base}${getPathname({ href, locale })}`,
    languages,
  };
}
