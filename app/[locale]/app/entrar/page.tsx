import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import EntrarApp from "./EntrarApp";

export default async function AppEntrarPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <EntrarApp />
    </Suspense>
  );
}
