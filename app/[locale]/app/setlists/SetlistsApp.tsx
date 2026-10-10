"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/navigation";
import { haptic } from "@/src/lib/native";
import { IconChevronRight, IconPlus } from "../_components/AppIcons";

export type SetlistCard = {
  id: number;
  name: string;
  isBand: boolean;
  dow: string | null;
  day: string | null;
  meta: string;
  next: boolean;
};

export default function SetlistsApp({ cards, canCreate }: { cards: SetlistCard[]; canCreate: boolean }) {
  const t = useTranslations("app.setlists");
  const router = useRouter();
  const hasBand = cards.some((c) => c.isBand);
  const [tab, setTab] = useState<"band" | "mine">(hasBand ? "band" : "mine");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const list = cards.filter((c) => (tab === "band" ? c.isBand : !c.isBand));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/setlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data?.setlist?.id) { setError(data?.error ?? t("createError")); return; }
    void haptic("medium");
    router.push({ pathname: "/app/setlists/[id]", params: { id: String(data.setlist.id) } });
  }

  return (
    <main className="app-screen" style={{ gap: 16, paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{t("title")}</h1>
        {canCreate && (
          <button type="button" className="app-icon-btn" aria-label={t("new")} aria-expanded={creating}
            onClick={() => { void haptic(); setCreating((v) => !v); }}
            style={creating ? { background: "var(--accent)", color: "#0d0d0f", borderColor: "var(--accent)" } : undefined}>
            <IconPlus />
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="app-card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
          <label htmlFor="sl-name" className="app-label">{t("newName")}</label>
          <input id="sl-name" className="app-input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={t("newPlaceholder")} maxLength={200} autoFocus />
          {error && <p role="alert" style={{ margin: 0, color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
          <button type="submit" className="app-btn app-btn--primary" disabled={busy || !name.trim()} style={{ height: 46 }}>
            {t("create")}
          </button>
        </form>
      )}

      <div role="tablist" className="app-segmented">
        <button role="tab" type="button" aria-selected={tab === "band"} onClick={() => setTab("band")}>{t("tabBand")}</button>
        <button role="tab" type="button" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>{t("tabMine")}</button>
      </div>

      {list.length === 0 ? (
        <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
            {tab === "band" ? t("emptyBand") : t("emptyMine")}
          </p>
          {tab === "band" && (
            <Link href="/app/bandas" className="app-btn app-btn--surface" style={{ height: 46 }}>{t("goBands")}</Link>
          )}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((c) => (
            <li key={c.id}>
              <Link href={{ pathname: "/app/setlists/[id]", params: { id: String(c.id) } }} className="app-card"
                style={{ padding: 14, borderRadius: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 56, borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: c.next ? "var(--accent)" : "var(--muted)" }}>{c.dow ?? "—"}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{c.day ?? "·"}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    {c.next && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "#0d0d0f", background: "var(--accent)", borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>{t("nextTag")}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{c.meta}</div>
                </div>
                <span style={{ color: "#6b6b70" }}><IconChevronRight size={20} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tab === "band" && list.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "var(--muted2)" }}>{t("bandHint")}</p>
      )}
    </main>
  );
}
