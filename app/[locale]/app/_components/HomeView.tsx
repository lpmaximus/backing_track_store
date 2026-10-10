import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/navigation";
import { localizeSongTitle } from "@/src/lib/catalogTitles";
import AppTabBar from "./AppTabBar";
import { BrandMark, IconBell, IconChevronRight, IconUpload, Wordmark } from "./AppIcons";
import type { HomeSong, NextEvent } from "../_lib/homeData";

const TZ = "America/Sao_Paulo";

function greetingKey(now: Date): "morning" | "afternoon" | "evening" {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Início do app — protótipo "Início" (Main.dc.html). Só desenha; os dados vêm da página. */
export default async function HomeView({ locale, user, nextEvent, recent, unread }: {
  locale: Locale;
  user: { name?: string | null; email?: string | null };
  nextEvent: NextEvent | null;
  recent: HomeSong[];
  unread: number;
}) {
  const t = await getTranslations({ locale, namespace: "app.home" });
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || null;
  const dateLocale = locale === "en" ? "en-US" : "pt-BR";
  const wd = nextEvent
    ? new Intl.DateTimeFormat(dateLocale, { weekday: "short", timeZone: TZ }).format(nextEvent.startsAt).replace(".", "").toUpperCase()
    : "";
  const day = nextEvent ? new Intl.DateTimeFormat(dateLocale, { day: "numeric", timeZone: TZ }).format(nextEvent.startsAt) : "";
  const time = nextEvent ? new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(nextEvent.startsAt) : "";

  return (
    <>
      <main className="app-screen">
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandMark size={24} />
            <Wordmark />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/app/mensagens" className="app-icon-btn" aria-label={unread ? t("messagesUnread", { n: unread }) : t("messages")}>
              <IconBell size={20} />
              {unread > 0 && (
                <span style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, background: "var(--accent)" }} />
              )}
            </Link>
            <Link href="/app/conta" className="app-icon-btn" aria-label={t("account")}
              style={{ background: "var(--surface3)", border: 0, fontWeight: 700, fontSize: 14 }}>
              {initials(user.name, user.email)}
            </Link>
          </div>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>
            {firstName ? t(`greeting.${greetingKey(new Date())}`, { name: firstName }) : t(`greetingNoName.${greetingKey(new Date())}`)}
          </div>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.01em" }}>{t("title")}</h1>
        </div>

        <section className="app-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,154,0,0.14)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <IconUpload />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("uploadTitle")}</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{t("uploadText")}</p>
            </div>
          </div>
          <Link href="/upload" className="app-btn app-btn--primary" style={{ height: 48, borderRadius: 12 }}>
            {t("uploadCta")}
          </Link>
        </section>

        {nextEvent && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 className="app-section-title">{t(nextEvent.type === "show" ? "nextShow" : "nextRehearsal")}</h2>
              <Link href={{ pathname: "/app/setlists/[id]", params: { id: String(nextEvent.setlistId) } }}
                style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {t("seeSetlist")}
              </Link>
            </div>
            <Link
              href={{ pathname: "/app/setlists/[id]", params: { id: String(nextEvent.setlistId) } }}
              className="app-card"
              style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 52, height: 56, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em" }}>{wd}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{day}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{nextEvent.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  {t("eventMeta", { setlist: nextEvent.setlistName, n: nextEvent.songCount, time })}
                </div>
              </div>
              <span style={{ color: "#6b6b70" }}><IconChevronRight size={20} /></span>
            </Link>
          </section>
        )}

        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 className="app-section-title" style={{ marginBottom: 6 }}>{t("keepPracticing")}</h2>
          {recent.length === 0 ? (
            <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{t("emptyRecent")}</p>
              <Link href="/app/estudio" className="app-btn app-btn--surface" style={{ height: 46 }}>{t("browseCatalog")}</Link>
            </div>
          ) : (
            recent.map((s) => (
              <Link key={s.slug} href={{ pathname: "/app/song/[slug]", params: { slug: s.slug } }} className="app-row-link">
                <MiniWave />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {localizeSongTitle(s.title, locale)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t("songMeta", { artist: s.artist, key: s.key, bpm: s.bpm })}
                  </div>
                </div>
                <span className="app-tag">{s.stemCount > 0 ? t("stems", { n: s.stemCount }) : t("chordsOnly")}</span>
              </Link>
            ))
          )}
        </section>
      </main>
      <AppTabBar />
    </>
  );
}

function MiniWave() {
  const hs = [10, 18, 13, 22, 8];
  return (
    <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border2)", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, paddingBottom: 12, flexShrink: 0 }}>
      {hs.map((h, i) => <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: "var(--accent)" }} />)}
    </div>
  );
}
