import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import { roleCan } from "@/src/lib/permissions";
import { getBandsWithMembers } from "../_lib/appData";
import BandaView from "./BandaView";

export const dynamic = "force-dynamic";

/** Banda — integrantes, papéis e convite por QR (Banda.dc.html + Convite.dc.html). */
export default async function AppBandasPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const userId = Number(session!.user.id);
  const canCreate = roleCan(session!.user.role, "create_band");

  const bands = await getBandsWithMembers(userId).catch(() => []);
  return <BandaView locale={locale} bands={bands} canCreate={canCreate} />;
}
