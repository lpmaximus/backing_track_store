"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type ChordSection = { section: string; timecode: number; chords: string };

const inputStyle = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border2)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
};

export default function ChordEditor({
  songId,
  initial,
  onSaved,
  onCancel,
}: {
  songId: number;
  initial: ChordSection[];
  onSaved: (sections: ChordSection[]) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("song");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<ChordSection[]>(
    initial.length ? initial : [{ section: "", timecode: 0, chords: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(i: number, patch: Partial<ChordSection>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { section: "", timecode: 0, chords: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  async function save() {
    if (saving) return;
    const cleaned = rows
      .map((r) => ({ section: r.section.trim(), timecode: Number(r.timecode) || 0, chords: r.chords.trim() }))
      .filter((r) => r.chords);
    if (cleaned.length === 0) {
      setError(t("errNeedChordLine"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/songs/${songId}/chords`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chords: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? tc("errSave"));
        return;
      }
      onSaved(cleaned);
    } catch {
      setError(t("errConnection"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      <p style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", color: "var(--muted)", margin: "0 0 12px" }}>
        {t("suggestChordFix")}
      </p>
      <p style={{ color: "var(--muted2)", fontSize: 12, margin: "0 0 14px" }}>
        {t("suggestChordHelp")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...inputStyle, width: 120 }} placeholder={t("sectionPlaceholder")} value={r.section} onChange={(e) => update(i, { section: e.target.value })} />
            <input style={{ ...inputStyle, width: 70 }} type="number" min={0} placeholder="seg" value={r.timecode} onChange={(e) => update(i, { timecode: Number(e.target.value) })} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Am G F E" value={r.chords} onChange={(e) => update(i, { chords: e.target.value })} />
            <button onClick={() => removeRow(i)} title={t("removeRow")} style={{ background: "none", border: "none", color: "var(--muted2)", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{ marginTop: 10, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>
        + Linha
      </button>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>
          {tc("cancel")}
        </button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: "8px 20px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? t("saving") : t("saveFix")}
        </button>
      </div>
    </div>
  );
}
