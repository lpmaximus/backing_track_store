import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import LegalPage from "@/app/components/LegalPage";
import type { Locale } from "@/src/i18n/routing";
import TermsContentPt from "./ContentPt";
import TermsContentEn from "./ContentEn";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legalPages" });
  return { title: t("termsTitle"), description: t("termsDescription") };
}

/**
 * Texto jurídico não passa pelo catálogo de mensagens: são ~250 parágrafos, e
 * quebrá-los em chaves tornaria impossível revisar o documento como documento.
 * Cada idioma tem seu arquivo de conteúdo; a versão em português é a que
 * prevalece juridicamente (ver cláusula no topo de ContentEn.tsx).
 */
export default async function TermosPage({
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

      <LegalPage title={t("termsTitle")} effectiveDate={t("termsEffective")}>
        {locale === "en" ? <TermsContentEn /> : <TermsContentPt />}
      </LegalPage>

      <SiteFooter />
    </div>
  );
}
