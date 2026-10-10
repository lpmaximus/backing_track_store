"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { QRCodeSVG } from "qrcode.react";
import { haptic } from "@/src/lib/native";

const INSTRUMENTS = ["drums", "bass", "guitar", "harmony", "vocal", "melody"] as const;
const INSTRUMENT_KEY: Record<string, string> = {
  drums: "instrumentDrums", bass: "instrumentBass", guitar: "instrumentGuitar",
  harmony: "instrumentHarmony", vocal: "instrumentVocals", melody: "instrumentMelody",
};

export function CreateBandForm() {
  const t = useTranslations("app.band");
  const tb = useTranslations("bands");
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/bands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error ?? t("createError"));
      return;
    }
    void haptic("medium");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label htmlFor="band-name" className="app-label">{t("bandName")}</label>
      <input id="band-name" className="app-input" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={tb("namePlaceholder")} maxLength={200} />
      {error && <p role="alert" style={{ margin: 0, color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
      <button type="submit" className="app-btn app-btn--primary" disabled={busy || !name.trim()} style={{ height: 46 }}>
        {tb("create")}
      </button>
    </form>
  );
}

/** Convite por QR (Convite.dc.html): o integrante escaneia com a câmera e entra. */
export function InvitePanel({ bandId }: { bandId: number }) {
  const t = useTranslations("app.band");
  const tb = useTranslations("bands");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    const res = await fetch(`/api/bands/${bandId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument: instrument || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !d?.path) { setError(d?.error ?? t("inviteError")); return; }
    void haptic("medium");
    setUrl(`${window.location.origin}${d.path}`);
    router.refresh(); // o convidado aparece na lista como "convidado"
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* sem clipboard: o link fica visível para copiar à mão */ }
  }

  if (!open) {
    return (
      <button type="button" className="app-btn app-btn--primary" onClick={() => { void haptic(); setOpen(true); }}>
        {t("inviteCta")}
      </button>
    );
  }

  return (
    <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t("inviteTitle")}</h3>
      {!url ? (
        <>
          <label htmlFor={`inst-${bandId}`} className="app-label">{tb("instrument")}</label>
          <select id={`inst-${bandId}`} className="app-input" value={instrument} onChange={(e) => setInstrument(e.target.value)}>
            <option value="">{t("instrumentLater")}</option>
            {INSTRUMENTS.map((v) => <option key={v} value={v}>{tb(INSTRUMENT_KEY[v])}</option>)}
          </select>
          {error && <p role="alert" style={{ margin: 0, color: "#ff6b6b", fontSize: 13 }}>{error}</p>}
          <button type="button" className="app-btn app-btn--primary" onClick={generate} disabled={busy} style={{ height: 46 }}>
            {t("generate")}
          </button>
        </>
      ) : (
        <>
          <div style={{ alignSelf: "center", background: "#fff", padding: 14, borderRadius: 16 }}>
            <QRCodeSVG value={url} size={200} level="M" />
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)", textAlign: "center" }}>{t("qrHint")}</p>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "#c8c8ce", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10, padding: "10px 12px", wordBreak: "break-all" }}>
            {url}
          </div>
          <button type="button" className="app-btn app-btn--surface" onClick={copy} style={{ height: 46 }}>
            {copied ? t("copied") : t("copy")}
          </button>
          <button type="button" className="app-btn app-btn--ghost" onClick={() => { setUrl(""); setInstrument(""); }} style={{ height: 46 }}>
            {t("another")}
          </button>
        </>
      )}
    </div>
  );
}
