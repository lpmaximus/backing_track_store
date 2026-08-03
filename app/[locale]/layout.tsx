import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { routing, htmlLang, type Locale } from "@/src/i18n/routing";
import { getPathname } from "@/src/i18n/navigation";
import { siteUrl } from "@/src/lib/siteUrl";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Metadata por idioma.
 *
 * ⚠️ NÃO declarar `alternates` aqui. No App Router o campo é herdado por toda
 * página que não o sobrescreve — e como este layout só conhece a home, o
 * resultado era o site inteiro apontando canonical para "/" (bug em produção,
 * corrigido em 03/08/2026). Canonical e hreflang agora são por página, via
 * `alternatesFor()` em src/lib/seo.ts.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const base = siteUrl();

  return {
    metadataBase: new URL(base),
    title: { default: t("title"), template: `%s · BackingTrack.store` },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      locale: htmlLang[locale].replace("-", "_"),
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => htmlLang[l].replace("-", "_")),
      siteName: "BackingTrack.store",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Necessário para que as páginas abaixo possam ser estáticas.
  setRequestLocale(locale);

  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
