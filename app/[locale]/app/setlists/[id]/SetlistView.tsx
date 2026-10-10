import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/navigation";
import { localizeSongTitle } from "@/src/lib/catalogTitles";
import { formatDuration, totalDuration } from "@/src/lib/mix";
import AppTabBar from "../../_components/AppTabBar";
import ScreenHeader from "../../_components/ScreenHeader";
import { IconChevronRight } from "../../_components/AppIcons";
import type { AppSetlistDetail } from "../../_lib/appData";
import { dateParts, initialsOf, INSTRUMENT_KEY, transposeKey } from "../../_lib/format";

/** Desenho da tela Setlist (Setlist.dc.html). Só desenha; os dados vêm da página. */
export default async function SetlistView({ locale, sl }: { locale: Locale; sl: AppSetlistDetail }) {
  const t = await getTranslations({ locale, namespace: "app.setlist" });
  const tb = await getTranslations({ locale, namespace: "bands" });
  const ev = sl.nextEvent ? { ...sl.nextEvent, d: dateParts(sl.nextEvent.startsAt, locale) } : null;
  const total = totalDuration(sl.songs);
  const roleLabel = !sl.bandId ? t("rolePersonal") : sl.canManage ? t("roleLeader") : t("roleMember");
  const inst = (v: string | null) => (v && INSTRUMENT_KEY[v] ? tb(INSTRUMENT_KEY[v]) : "—");

  return (
    <>
      <main className="app-screen" style={{ gap: 18, paddingLeft: 16, paddingRight: 16 }}>
        <ScreenHeader fallback="/app/setlists" />

        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {ev && (
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", background: "rgba(255,154,0,0.12)", borderRadius: 6, padding: "4px 8px" }}>
                {ev.d.dow} · {ev.d.day} {ev.d.month} · {ev.d.time}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "#c8c8ce", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 8px" }}>
              {roleLabel}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 800 }}>{sl.name}</h1>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {[sl.bandName ?? t("personal"), t("songs", { n: sl.songs.length }), total > 0 ? `~${formatDuration(total)}` : null].filter(Boolean).join(" · ")}
          </div>
          {ev && <div style={{ fontSize: 13, color: "#c8c8ce" }}>{ev.title}{ev.location ? ` · ${ev.location}` : ""}</div>}
          {sl.notes && <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted)", whiteSpace: "pre-line" }}>{sl.notes}</p>}
        </section>

        {sl.members.length > 0 && (
          <section aria-label={tb("members")} style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
            {sl.members.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 56 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: m.isMe ? "var(--accent)" : "#2e2e35", color: m.isMe ? "#0d0d0f" : "var(--text)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {initialsOf(m.display)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", maxWidth: 72, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {inst(m.instrument)}
                </div>
              </div>
            ))}
          </section>
        )}

        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 className="app-section-title" style={{ marginBottom: 6 }}>{t("repertoire")}</h2>
          {sl.songs.length === 0 ? (
            <div className="app-card"><p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>{t("empty")}</p></div>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {sl.songs.map((s, i) => (
                <li key={s.itemId}>
                  <Link
                    href={{ pathname: "/app/song/[slug]", params: { slug: s.slug }, query: { sl: String(s.itemId) } }}
                    className="app-row-link"
                    style={{ padding: "12px 0" }}
                  >
                    <span style={{ width: 24, textAlign: "center", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{localizeSongTitle(s.title, locale)}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.notes ? `${s.notes} · ${s.bpm} BPM` : `${s.artist} · ${s.bpm} BPM`}
                      </div>
                    </div>
                    <div className="app-keybadge" style={{ width: "auto", minWidth: 44, padding: "0 8px" }}>
                      {transposeKey(s.key, s.transpose)}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sl.songs.length > 0 && (
            <Link href={{ pathname: "/setlists/[id]/palco", params: { id: String(sl.id) } }} className="app-btn app-btn--primary">
              {t("stage")}
            </Link>
          )}
          {ev && (
            <Link href={{ pathname: "/setlists/[id]/ensaios/[eventId]", params: { id: String(sl.id), eventId: String(ev.id) } }}
              className="app-btn app-btn--surface" style={{ justifyContent: "space-between" }}>
              <span>{t(ev.type === "show" ? "showDetails" : "rehearsalDetails")}</span>
              <IconChevronRight size={18} />
            </Link>
          )}
          {sl.canManage && (
            <Link href={{ pathname: "/setlists/[id]", params: { id: String(sl.id) } }}
              className="app-btn app-btn--ghost" style={{ justifyContent: "space-between" }}>
              <span>{t("edit")}</span>
              <IconChevronRight size={18} />
            </Link>
          )}
        </section>
      </main>
      <AppTabBar />
    </>
  );
}
