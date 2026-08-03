import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { alternatesFor } from "@/src/lib/seo";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import PlanosContent from "./PlanosContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "plans" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/planos", locale),
  };
}

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — senão o bundler leva neon() para o browser
// ("No database connection string was provided to neon()"). A parte interativa
// (useSession, toggle de plano) fica isolada em PlanosContent ("use client").
export default function PlanosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteHeader />
      <PlanosContent />
      <SiteFooter />
    </div>
  );
}
