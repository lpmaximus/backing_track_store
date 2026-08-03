import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import LegalPage from "@/app/components/LegalPage";
import type { Locale } from "@/src/i18n/routing";
import PrivacyContentPt from "./ContentPt";
import PrivacyContentEn from "./ContentEn";
import { alternatesFor } from "@/src/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalPages" });
  return {
    title: t("privacyTitle"),
    description: t("privacyDescription") ,
    alternates: alternatesFor("/privacidade", locale),
  };
}

export default async function PrivacidadePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legalPages");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <LegalPage title={t("privacyTitle")} effectiveDate={t("privacyEffective")}>
        {locale === "en" ? <PrivacyContentEn /> : <PrivacyContentPt />}
      </LegalPage>

      <SiteFooter />
    </div>
  );
}
