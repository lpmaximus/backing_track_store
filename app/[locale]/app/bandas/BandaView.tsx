import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/navigation";
import AppTabBar from "../_components/AppTabBar";
import { IconChevronRight } from "../_components/AppIcons";
import type { AppBand } from "../_lib/appData";
import { initialsOf, INSTRUMENT_KEY } from "../_lib/format";
import { CreateBandForm, InvitePanel } from "./BandaActions";

const MAX_MEMBERS = 6;

/** Desenho da tela Banda (Banda.dc.html). Só desenha; os dados vêm da página. */
export default async function BandaView({ locale, bands, canCreate }: { locale: Locale; bands: AppBand[]; canCreate: boolean }) {
  const t = await getTranslations({ locale, namespace: "app.band" });
  const tb = await getTranslations({ locale, namespace: "bands" });
  const inst = (v: string | null) => (v && INSTRUMENT_KEY[v] ? tb(INSTRUMENT_KEY[v]) : t("noInstrument"));

  return (
    <>
      <main className="app-screen" style={{ gap: 18, paddingLeft: 16, paddingRight: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{bands.length > 1 ? t("titleMany") : t("title")}</h1>

        {bands.length === 0 && (
          <section className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
              {canCreate ? t("emptyLeader") : t("emptyMember")}
            </p>
            {canCreate ? <CreateBandForm /> : (
              <Link href="/planos" className="app-btn app-btn--surface" style={{ height: 46 }}>{t("seePlans")}</Link>
            )}
          </section>
        )}

        {bands.map((b) => {
          const active = b.members.filter((m) => m.status === "active").length;
          return (
            <section key={b.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{b.name}</h2>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>
                    {[b.hasSubscription ? t("planBand") : t("noPlan"), t("membersCount", { n: active, max: MAX_MEMBERS })].join(" · ")}
                  </div>
                </div>
                <Link href="/app/setlists" className="app-btn app-btn--surface" style={{ height: 46, justifyContent: "space-between" }}>
                  <span>{t("bandSetlists")}</span>
                  <IconChevronRight size={18} />
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h3 className="app-section-title" style={{ marginBottom: 4 }}>{tb("membersTitle")}</h3>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {b.members.map((m) => {
                    const tag = m.isLeader ? t("roleLeader") : m.status === "active" ? t("roleMember") : t("roleInvited");
                    const tagColor = m.isLeader ? "var(--accent)" : m.status === "active" ? "#c8c8ce" : "var(--muted)";
                    const tagBorder = m.isLeader ? "rgba(255,154,0,0.5)" : m.status === "active" ? "#3a3a42" : "var(--border2)";
                    return (
                      <li key={m.id} className="app-row-link">
                        <div style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: m.isMe ? "var(--accent)" : m.status === "active" ? "#2e2e35" : "var(--surface)", color: m.isMe ? "#0d0d0f" : m.status === "active" ? "var(--text)" : "var(--muted)", border: m.status === "active" ? "none" : "1px dashed var(--border2)" }}>
                          {m.display ? initialsOf(m.display) : "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {m.display || t("pendingInvite")}{m.isMe ? ` ${t("you")}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{inst(m.instrument)}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: tagColor, border: `1px solid ${tagBorder}`, borderRadius: 6, padding: "3px 7px", flexShrink: 0 }}>{tag}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {b.isLeader && (
                b.members.length >= MAX_MEMBERS
                  ? <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{tb("maxMembers")}</p>
                  : <InvitePanel bandId={b.id} />
              )}
            </section>
          );
        })}

        {bands.length > 0 && (
          <Link href="/bandas" style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textAlign: "center", padding: "6px 0" }}>
            {t("manageOnSite")}
          </Link>
        )}
      </main>
      <AppTabBar />
    </>
  );
}
