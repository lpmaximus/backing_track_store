import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { alternatesFor } from "@/src/lib/seo";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import BandasContent from "./BandasContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bands" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: alternatesFor("/bandas", locale),
  };
}

export default function BandasPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <BandasContent />
      <SiteFooter />
    </div>
  );
}
