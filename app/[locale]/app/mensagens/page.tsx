import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import AppTabBar from "../_components/AppTabBar";
import ScreenHeader from "../_components/ScreenHeader";
import { getNotifications } from "../_lib/appData";
import { toAppPath } from "../_lib/format";
import MensagensList from "./MensagensList";

export const dynamic = "force-dynamic";

/** Mensagens — caixa de avisos automáticos (Mensagens.dc.html). */
export default async function AppMensagensPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const t = await getTranslations({ locale, namespace: "app.messages" });
  const items = await getNotifications(Number(session!.user.id)).catch(() => []);
  const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <main className="app-screen" style={{ gap: 16, paddingLeft: 16, paddingRight: 16 }}>
        <ScreenHeader title={t("title")} fallback="/app/conta" />
        <MensagensList
          items={items.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            href: toAppPath(n.link),
            read: n.read,
            date: fmt.format(n.createdAt),
          }))}
        />
      </main>
      <AppTabBar />
    </>
  );
}
