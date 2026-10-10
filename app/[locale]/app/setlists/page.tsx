import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import type { Locale } from "@/src/i18n/routing";
import { Link, redirect } from "@/src/i18n/navigation";
import { hasProAccess } from "@/src/lib/access";
import { roleCan } from "@/src/lib/permissions";
import AppTabBar from "../_components/AppTabBar";
import { getSetlists } from "../_lib/appData";
import { dateParts } from "../_lib/format";
import SetlistsApp, { type SetlistCard } from "./SetlistsApp";

export const dynamic = "force-dynamic";

/** Setlists — "Da banda" | "Pessoais" (Setlists.dc.html). */
export default async function AppSetlistsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/app/boas-vindas", locale });
  const userId = Number(session!.user.id);
  const role = session!.user.role;
  const t = await getTranslations({ locale, namespace: "app.setlists" });

  // Mesma porta do GET /api/setlists: acesso Pro efetivo (inclui quem herda da banda).
  const allowed = await hasProAccess(userId, role);
  if (!allowed) {
    return (
      <>
        <main className="app-screen" style={{ gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{t("title")}</h1>
          <section className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("lockedTitle")}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{t("lockedText")}</p>
            <Link href="/planos" className="app-btn app-btn--primary" style={{ height: 46 }}>{t("seePlans")}</Link>
          </section>
        </main>
        <AppTabBar />
      </>
    );
  }

  const rows = await getSetlists(userId).catch(() => []);
  const firstUpcoming = rows.find((r) => r.nextEvent)?.id ?? null;
  const cards: SetlistCard[] = rows.map((r) => {
    const d = r.nextEvent ? dateParts(r.nextEvent.startsAt, locale) : null;
    return {
      id: r.id,
      name: r.name,
      isBand: r.bandId != null,
      dow: d?.dow ?? null,
      day: d?.day ?? null,
      meta: [
        r.bandName ?? t("personal"),
        t("songs", { n: r.songCount }),
        r.nextEvent ? `${r.nextEvent.title} · ${d!.time}` : null,
      ].filter(Boolean).join(" · "),
      next: r.id === firstUpcoming,
    };
  });

  return (
    <>
      <SetlistsApp cards={cards} canCreate={roleCan(role, "create_setlist")} />
      <AppTabBar />
    </>
  );
}
