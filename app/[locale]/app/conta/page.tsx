import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import { roleLabel } from "@/src/lib/roles";
import { checkUploadQuota } from "@/src/lib/quota";
import { getAccountBasics, getBandsWithMembers } from "../_lib/appData";
import { getUnreadCount } from "../_lib/homeData";
import ContaView from "./ContaView";

export const dynamic = "force-dynamic";

/** Conta — perfil, plano, cota do mês e atalhos (Conta.dc.html). */
export default async function AppContaPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const userId = Number(session!.user.id);

  const [me, bands, unread, quota] = await Promise.all([
    getAccountBasics(userId).catch(() => null),
    getBandsWithMembers(userId).catch(() => []),
    getUnreadCount(userId).catch(() => 0),
    checkUploadQuota(userId, session!.user.role).catch(() => null),
  ]);

  return (
    <ContaView
      locale={locale}
      name={me?.name || session!.user.name || me?.email || ""}
      email={me?.email ?? null}
      tier={roleLabel(me?.role ?? session!.user.role, bands.length > 0)}
      bandCount={bands.length}
      unread={unread}
      quota={quota}
    />
  );
}
