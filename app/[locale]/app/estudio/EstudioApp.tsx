"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { localizeSongTitle } from "@/src/lib/catalogTitles";
import { haptic } from "@/src/lib/native";
import { IconCheck, IconPlus, IconSearch } from "../_components/AppIcons";

type Tab = "mine" | "catalog";

type MineSong = {
  id: number; slug: string; title: string; artist: string; key: string; bpm: number;
  processingStatus: string; shared: boolean;
};
type CatalogSong = { id: number; slug: string; title: string; artist: string; key: string; bpm: number; genre?: string };
type Versao = { id: number; songId: number; title: string | null; songTitle: string; songSlug: string; songArtist: string };

const PROCESSING = new Set(["queued", "separating", "transcribing"]);

export default function EstudioApp({ canStudio, canShared }: { canStudio: boolean; canShared: boolean }) {
  const t = useTranslations("app.studio");
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("mine");
  const [q, setQ] = useState("");

  const [mine, setMine] = useState<MineSong[] | null>(null);
  const [versions, setVersions] = useState<Versao[]>([]);
  const [catalog, setCatalog] = useState<CatalogSong[] | null>(null);
  const [shared, setShared] = useState<CatalogSong[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  // Minhas músicas (+ versões do estúdio, se o plano tiver).
  useEffect(() => {
    let alive = true;
    fetch("/api/songs/mine")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: MineSong[]) => { if (alive) setMine(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) setMine([]); });
    if (canStudio) {
      fetch("/api/estudio")
        .then((r) => (r.ok ? r.json() : { versions: [] }))
        .then((d: { versions?: Versao[] }) => { if (alive) setVersions(d.versions ?? []); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [canStudio]);

  // Catálogo: carrega só quando a aba abre pela primeira vez.
  useEffect(() => {
    if (tab !== "catalog" || catalog) return;
    let alive = true;
    fetch("/api/songs")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: CatalogSong[]) => { if (alive) setCatalog(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) setCatalog([]); });
    if (canShared) {
      fetch("/api/songs/shared")
        .then((r) => (r.ok ? r.json() : []))
        .then((d: CatalogSong[]) => { if (alive) setShared(Array.isArray(d) ? d : []); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [tab, catalog, canShared]);

  const inStudio = useMemo(() => new Set(versions.map((v) => v.songId)), [versions]);

  const addToStudio = useCallback(async (song: CatalogSong) => {
    setBusy(song.id);
    void haptic();
    try {
      const res = await fetch("/api/estudio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => null);
        // O POST devolve só a linha de user_songs; slug/artista vêm da música.
        const v: Versao = {
          id: Number(d?.version?.id) || -song.id, songId: song.id, title: d?.version?.title ?? null,
          songTitle: song.title, songSlug: song.slug, songArtist: song.artist,
        };
        setVersions((prev) => (prev.some((p) => p.songId === song.id) ? prev : [v, ...prev]));
      }
    } finally {
      setBusy(null);
    }
  }, []);

  const needle = q.trim().toLowerCase();
  const match = (s: { title: string; artist: string }) =>
    !needle || s.title.toLowerCase().includes(needle) || s.artist.toLowerCase().includes(needle);

  return (
    <main className="app-screen" style={{ gap: 14, paddingLeft: 16, paddingRight: 16 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>{t("title")}</h1>

      <div role="tablist" className="app-segmented">
        <button role="tab" type="button" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>{t("tabMine")}</button>
        <button role="tab" type="button" aria-selected={tab === "catalog"} onClick={() => setTab("catalog")}>{t("tabCatalog")}</button>
      </div>

      <label style={{ height: 46, borderRadius: 12, border: "1px solid var(--border2)", background: "var(--surface2)", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", color: "var(--muted2)" }}>
        <IconSearch />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          aria-label={t("search")} placeholder={tab === "mine" ? t("searchMine") : t("searchCatalog")}
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: "var(--text)", font: "inherit", fontSize: 16, outline: "none" }} />
      </label>

      {tab === "mine" ? (
        <>
          {mine === null ? <Skeleton /> : mine.filter(match).length === 0 && versions.length === 0 ? (
            <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{needle ? t("noResults") : t("emptyMine")}</p>
              {!needle && <Link href="/upload" className="app-btn app-btn--primary" style={{ height: 46 }}>{t("uploadCta")}</Link>}
            </div>
          ) : (
            <ul style={listStyle}>
              {mine.filter(match).map((s) => {
                const processing = PROCESSING.has(s.processingStatus);
                const failed = s.processingStatus === "failed";
                return (
                  <li key={s.id}>
                    <SongCard
                      slug={s.slug} keyName={s.key}
                      title={localizeSongTitle(s.title, locale)}
                      meta={t("meta", { artist: s.artist, bpm: s.bpm })}
                      badge={processing ? t("processing") : failed ? t("failed") : s.shared ? t("sharedBadge") : null}
                      badgeTone={failed ? "danger" : processing ? "accent" : "muted"}
                      disabled={processing || failed}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {versions.filter((v) => match({ title: v.title || v.songTitle, artist: v.songArtist })).length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              <h2 className="app-section-title">{t("versionsTitle")}</h2>
              <ul style={listStyle}>
                {versions.filter((v) => match({ title: v.title || v.songTitle, artist: v.songArtist })).map((v) => (
                  <li key={v.id}>
                    <SongCard slug={v.songSlug} keyName="" title={v.title || localizeSongTitle(v.songTitle, locale)} meta={v.songArtist} badge={t("myVersion")} badgeTone="muted" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <>
          <p style={{ margin: 0, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 14, padding: "12px 14px", fontSize: 12, lineHeight: 1.5, color: "#a6a6ae" }}>
            {canStudio ? t("catalogHintStudio") : t("catalogHint")}
          </p>

          {canShared && shared.filter(match).length > 0 && (
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 className="app-section-title">{t("communityTitle")}</h2>
              <ul style={listStyle}>
                {shared.filter(match).map((s) => (
                  <li key={`sh-${s.id}`}>
                    <SongCard slug={s.slug} keyName={s.key} title={s.title} meta={t("meta", { artist: s.artist, bpm: s.bpm })}
                      action={canStudio ? <AddButton added={inStudio.has(s.id)} busy={busy === s.id} onAdd={() => addToStudio(s)} t={t} /> : null} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {canShared && <h2 className="app-section-title">{t("catalogTitle")}</h2>}
            {catalog === null ? <Skeleton /> : catalog.filter(match).length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("noResults")}</p>
            ) : (
              <ul style={listStyle}>
                {catalog.filter(match).map((s) => (
                  <li key={s.id}>
                    <SongCard slug={s.slug} keyName={s.key} title={localizeSongTitle(s.title, locale)} meta={t("meta", { artist: s.artist, bpm: s.bpm })}
                      action={canStudio ? <AddButton added={inStudio.has(s.id)} busy={busy === s.id} onAdd={() => addToStudio(s)} t={t} /> : null} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

const listStyle: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 };

function SongCard({
  slug, keyName, title, meta, badge, badgeTone = "muted", action, disabled,
}: {
  slug: string; keyName: string; title: string; meta: string;
  badge?: string | null; badgeTone?: "muted" | "accent" | "danger";
  action?: React.ReactNode; disabled?: boolean;
}) {
  const color = badgeTone === "accent" ? "var(--accent)" : badgeTone === "danger" ? "#ff6b6b" : "var(--muted)";
  const body = (
    <>
      <div className="app-keybadge">{keyName || "—"}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
        {badge && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color }}>{badge.toUpperCase()}</div>}
      </div>
    </>
  );
  return (
    <div className="app-card" style={{ padding: 12, borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
      {disabled ? (
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, opacity: 0.75 }}>{body}</div>
      ) : (
        <Link href={{ pathname: "/app/song/[slug]", params: { slug } }} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
          {body}
        </Link>
      )}
      {action}
    </div>
  );
}

function AddButton({ added, busy, onAdd, t }: {
  added: boolean; busy: boolean; onAdd: () => void; t: ReturnType<typeof useTranslations>;
}) {
  return (
    <button
      type="button"
      onClick={added ? undefined : onAdd}
      disabled={busy}
      aria-pressed={added}
      aria-label={added ? t("added") : t("add")}
      style={{
        width: 44, height: 44, borderRadius: 22, flexShrink: 0, cursor: added ? "default" : "pointer",
        border: `1px solid ${added ? "var(--accent)" : "#3a3a42"}`,
        background: added ? "var(--accent)" : "transparent",
        color: added ? "#0d0d0f" : "var(--text)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {added ? <IconCheck /> : <IconPlus />}
    </button>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3].map((i) => <div key={i} className="app-skeleton" style={{ height: 70 }} />)}
    </div>
  );
}
