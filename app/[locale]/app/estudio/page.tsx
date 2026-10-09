import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import { roleCan } from "@/src/lib/permissions";
import AppTabBar from "../_components/AppTabBar";
import EstudioApp from "./EstudioApp";

/** Meu Estúdio — Minhas músicas | Catálogo (Estudio.dc.html + Catalogo.dc.html). */
export default async function AppEstudioPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect({ href: "/app/boas-vindas", locale });
  const role = session!.user.role;

  return (
    <>
      <EstudioApp
        canStudio={roleCan(role, "copy_song")}
        canShared={roleCan(role, "view_shared_catalog")}
      />
      <AppTabBar />
    </>
  );
}
