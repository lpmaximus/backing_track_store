"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
// NextLink (não o do next-intl) para o link da notificação: o destino vem do
// banco como string livre, então não passa pelo <Link> tipado. A tradução da
// rota é feita à mão por localizePath.
import NextLink from "next/link";
import { Link } from "@/src/i18n/navigation";
import { localizePath } from "@/src/i18n/localizePath";
import { htmlLang, type Locale } from "@/src/i18n/routing";

type Account = {
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  tier: string;
  createdAt: string;
  bands: { id: number; name: string; leader: boolean }[];
};

type NotificationItem = {
  id: number;
  type: "system" | "promo" | "band";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

// Formatação segue o idioma da interface: "28 jul 2026" vs "Jul 28, 2026".
function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ContaContent() {
  const locale = useLocale() as Locale;
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const dateLocale = htmlLang[locale];
  const TYPE_LABEL: Record<NotificationItem["type"], string> = {
    system: t("typeSystem"), promo: t("typePromo"), band: t("typeBand"),
  };
  const { data: session, status } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    try {
      const [accRes, notifRes] = await Promise.all([
        fetch("/api/account/me"),
        fetch("/api/notifications"),
      ]);
      if (accRes.ok) setAccount(await accRes.json());
      if (notifRes.ok) {
        const d = await notifRes.json();
        setItems(Array.isArray(d.items) ? d.items : []);
        setUnread(typeof d.unread === "number" ? d.unread : 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function markOneRead(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      if (res.ok) {
        setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnread(prev => Math.max(0, prev - 1));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (res.ok) {
        setItems(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
      }
    } finally {
      setMarkingAll(false);
    }
  }

  const isPro = account ? account.role === "pro" || account.role === "proband" || account.role === "admin" : false;

  return (
    <div style={{ flex: 1, maxWidth: 760, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      {status === "loading" || loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>{tc("loading")}</p>
      ) : !session?.user ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>{t("signedOut")}</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>{tc("signIn")}</Link>
        </div>
      ) : (
        <>
          <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 24px", color: "var(--text)" }}>{t("heading")}</h1>

          {/* ─── Dados da conta ──────────────────────────────────────────── */}
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: account?.bands.length ? 18 : 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "var(--surface3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                fontWeight: 700, color: "var(--text)", flexShrink: 0, overflow: "hidden",
              }}>
                {account?.image
                  ? <img src={account.image} alt={account.name ?? t("user")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (account?.name ?? account?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{account?.name ?? t("user")}</span>
                  {isPro ? (
                    <span className="pro-badge">{account?.tier}</span>
                  ) : (
                    <span style={{
                      background: "var(--surface3)", color: "var(--muted)",
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                      padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border2)",
                    }}>{account?.tier}</span>
                  )}
                </div>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{account?.email}</p>
                {account?.createdAt && (
                  <p style={{ color: "var(--muted2)", fontSize: 12, margin: "2px 0 0" }}>{t("memberSince", { date: formatDate(account.createdAt, dateLocale) })}</p>
                )}
              </div>
              {!isPro && (
                <Link href="/planos" className="btn-primary" style={{ padding: "9px 18px", fontSize: 13, whiteSpace: "nowrap" }}>
                  {t("upgradePro")}
                </Link>
              )}
            </div>

            {account && account.bands.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {account.bands.map(b => (
                  <Link key={b.id} href="/bandas" style={{
                    fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20,
                    background: "var(--surface3)", color: "var(--text)", border: "1px solid var(--border2)",
                  }}>
                    {b.name}{b.leader ? t("leaderSuffix") : ""}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ─── Mensagens ───────────────────────────────────────────────── */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 16 }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 17, margin: "0 0 2px", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                  {t("messagesTitle")}
                  {unread > 0 && (
                    <span style={{
                      background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 800,
                      padding: "1px 8px", borderRadius: 10, lineHeight: "16px",
                    }}>{unread}</span>
                  )}
                </h2>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("messagesSubtitle")}</p>
              </div>
              {unread > 0 && (
                <button onClick={markAllRead} disabled={markingAll} style={{
                  background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8,
                  padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: markingAll ? "default" : "pointer",
                  color: "var(--text)", opacity: markingAll ? 0.6 : 1, whiteSpace: "nowrap",
                }}>
                  {t("markAllRead")}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                  {t("noMessagesYet")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map(n => (
                  <div key={n.id} style={{
                    background: n.read ? "var(--surface)" : "rgba(255,154,0,0.06)",
                    border: `1px solid ${n.read ? "var(--border)" : "rgba(255,154,0,0.3)"}`,
                    borderRadius: 12, padding: "14px 18px",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", padding: "2px 7px",
                          borderRadius: 4, background: "var(--surface3)", color: "var(--muted2)",
                        }}>{TYPE_LABEL[n.type]}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{n.title}</span>
                      </div>
                      {n.body && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 4px" }}>{n.body}</p>}
                      <p style={{ color: "var(--muted2)", fontSize: 11, margin: 0 }}>{formatDateTime(n.createdAt, dateLocale)}</p>
                      {n.link && (
                        <NextLink href={localizePath(n.link, locale)} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{t("seeMore")}</NextLink>
                      )}
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markOneRead(n.id)}
                        disabled={busyId === n.id}
                        style={{
                          background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8,
                          padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: busyId === n.id ? "default" : "pointer",
                          color: "var(--text)", opacity: busyId === n.id ? 0.5 : 1, whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
