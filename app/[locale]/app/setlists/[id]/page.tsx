import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { redirect } from "@/src/i18n/navigation";
import { hasProAccess } from "@/src/lib/access";
import { getSetlistDetail } from "../../_lib/appData";
import SetlistView from "./SetlistView";

export const dynamic = "force-dynamic";

/** Setlist (repertório do ensaio/show) — Setlist.dc.html. */
export default async function AppSetlistPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const userId = Number(session!.user.id);
  if (!(await hasProAccess(userId, session!.user.role))) redirect({ href: "/app/setlists", locale });

  const sl = await getSetlistDetail(Number(id), userId);
  if (!sl) notFound();

  return <SetlistView locale={locale} sl={sl} />;
}
