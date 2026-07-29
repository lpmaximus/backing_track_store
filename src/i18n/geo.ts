/**
 * Detecção de idioma por país (ADR-BTS-006).
 *
 * Regra pedida pelo produto: acesso de fora do Brasil abre em inglês, acesso
 * do Brasil abre em português. Ordem de precedência:
 *
 *   1. Prefixo explícito na URL (/en/...)  → sempre vence
 *   2. Cookie NEXT_LOCALE                  → escolha manual do usuário
 *   3. País do IP (x-vercel-ip-country)    → BR = pt, resto = en
 *   4. Accept-Language                     → pt* = pt, resto = en
 *   5. defaultLocale (pt)
 *
 * Países lusófonos ficam em português mesmo fora do Brasil: são mercados que
 * entendem o conteúdo atual, e mandá-los para o inglês seria uma piora.
 */
import type { NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "./routing";

/** Países que continuam vendo o site em português. */
export const PT_COUNTRIES = new Set([
  "BR", // Brasil
  "PT", // Portugal
  "AO", // Angola
  "MZ", // Moçambique
  "CV", // Cabo Verde
  "GW", // Guiné-Bissau
  "ST", // São Tomé e Príncipe
  "TL", // Timor-Leste
  "GQ", // Guiné Equatorial
]);

export const LOCALE_COOKIE = "NEXT_LOCALE";

function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Idioma já explícito no caminho (/en/... ). `null` quando não há prefixo. */
export function localeFromPathname(pathname: string): Locale | null {
  const first = pathname.split("/")[1];
  return isLocale(first) ? first : null;
}

/** País do visitante segundo o edge da Vercel/Cloudflare. */
export function countryFromRequest(req: NextRequest): string | null {
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-country-code");
  return country ? country.toUpperCase() : null;
}

function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // Só olha o idioma de maior prioridade — não precisa de negociação completa.
  const top = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (top.startsWith("pt")) return "pt";
  if (top) return "en";
  return null;
}

/**
 * Idioma a aplicar quando a URL não tem prefixo.
 * Retorna também de onde veio a decisão, para debug e para o header de Vary.
 */
export function resolveLocale(req: NextRequest): {
  locale: Locale;
  source: "cookie" | "country" | "header" | "default";
} {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return { locale: cookie, source: "cookie" };

  const country = countryFromRequest(req);
  if (country) {
    return { locale: PT_COUNTRIES.has(country) ? "pt" : "en", source: "country" };
  }

  const fromHeader = localeFromAcceptLanguage(req.headers.get("accept-language"));
  if (fromHeader) return { locale: fromHeader, source: "header" };

  return { locale: defaultLocale, source: "default" };
}
