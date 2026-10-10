import { getTranslations } from "next-intl/server";
import type { Locale } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/navigation";
import AppTabBar from "../_components/AppTabBar";
import { IconChevronRight } from "../_components/AppIcons";
import { initialsOf } from "../_lib/format";
import SignOutButton from "./SignOutButton";

/** Desenho da tela Conta (Conta.dc.html). Só desenha; os dados vêm da página. */
export default async function ContaView({ locale, name, email, tier, bandCount, unread, quota }: {
  locale: Locale;
  name: string;
  email: string | null;
  tier: string;
  bandCount: number;
  unread: number;
  quota: { used: number; limit: number; trialPack: boolean } | null;
}) {
  const t = await getTranslations({ locale, namespace: "app.account" });
  const otherLocale = locale === "en" ? "pt" : "en";

  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "0 16px", borderBottom: "1px solid var(--border)" };
  const value = (v: React.ReactNode) => <span style={{ fontSize: 13, color: "var(--muted)" }}>{v}</span>;
  const chev = <span style={{ color: "#6b6b70" }}><IconChevronRight size={18} /></span>;

  return (
    <>
      <main className="app-screen" style={{ gap: 18, paddingLeft: 16, paddingRight: 16 }}>
        <section style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: "var(--accent)", color: "#0d0d0f", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initialsOf(name)}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</h1>
            <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: "#0d0d0f", background: "var(--accent)", borderRadius: 6, padding: "4px 8px", flexShrink: 0 }}>{tier}</span>
        </section>

        <Link href="/planos" className="app-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{t("plan", { tier })}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{t("manage")}</span>
          </div>
          {quota && (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {quota.trialPack ? t("quotaTrial", { used: quota.used, limit: quota.limit }) : t("quota", { used: quota.used, limit: quota.limit })}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface3)", overflow: "hidden" }} aria-hidden="true">
                <div style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%`, height: "100%", background: "var(--accent)" }} />
              </div>
            </>
          )}
        </Link>

        <nav aria-label={t("settings")} className="app-card" style={{ padding: 0, overflow: "hidden" }}>
          <Link href="/app/mensagens" style={rowStyle}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("messages")}</span>
            {unread > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "var(--accent)", color: "#0d0d0f", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{unread}</span>}
            {chev}
          </Link>
          <Link href="/app/bandas" style={rowStyle}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("bands")}</span>
            {value(bandCount)}
            {chev}
          </Link>
          <Link href="/app/estudio" style={rowStyle}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("songs")}</span>
            {chev}
          </Link>
          <Link href="/app/conta" locale={otherLocale} style={rowStyle}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("language")}</span>
            {value(locale === "en" ? "English" : "Português")}
            {chev}
          </Link>
          <Link href="/conta" style={{ ...rowStyle, borderBottom: 0 }}>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{t("fullAccount")}</span>
            {chev}
          </Link>
        </nav>

        <div style={{ display: "flex", justifyContent: "center", gap: 18, fontSize: 12 }}>
          <Link href="/termos" style={{ color: "var(--muted)" }}>{t("terms")}</Link>
          <Link href="/privacidade" style={{ color: "var(--muted)" }}>{t("privacy")}</Link>
        </div>

        <SignOutButton />
      </main>
      <AppTabBar />
    </>
  );
}
