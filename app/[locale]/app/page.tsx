import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import HomeView from "./_components/HomeView";
import { getNextEvent, getRecentSongs, getUnreadCount } from "./_lib/homeData";

export const dynamic = "force-dynamic";

/** Início do app — protótipo "Início" (Main.dc.html). */
export default async function AppHome({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const user = session!.user;
  const userId = Number(user.id);

  // Cada bloco falha sozinho: sem ensaio/histórico a tela ainda abre.
  const [nextEvent, recent, unread] = await Promise.all([
    getNextEvent(userId).catch(() => null),
    getRecentSongs(userId).catch(() => []),
    getUnreadCount(userId).catch(() => 0),
  ]);

  return <HomeView locale={locale} user={user} nextEvent={nextEvent} recent={recent} unread={unread} />;
}
