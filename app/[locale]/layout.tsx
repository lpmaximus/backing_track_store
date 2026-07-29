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
 * Metadata por idioma + hreflang.
 * O Google precisa ver, em cada versão, o link para a outra — sem isso ele
 * trata /en como conteúdo duplicado e escolhe sozinho qual indexar.
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
    alternates: {
      canonical: `${base}${getPathname({ href: "/", locale })}`,
      languages: {
        "pt-BR": `${base}${getPathname({ href: "/", locale: "pt" })}`,
        en: `${base}${getPathname({ href: "/", locale: "en" })}`,
        "x-default": base,
      },
    },
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
