"use client";

import type * as React from "react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { isProRole, roleLabel } from "@/src/lib/roles";

type MySong = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  duration: number;
  thumbnailUrl: string | null;
  processingStatus: "ready" | "queued" | "separating" | "transcribing" | "failed";
  shared: boolean;
  createdAt: string;
};

const PENDING_STATUSES = new Set<MySong["processingStatus"]>(["queued", "separating", "transcribing"]);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PerfilContent() {
  const t = useTranslations("mySongs");
  const tc = useTranslations("common");
  const { data: session, status } = useSession();
  const [songs, setSongs] = useState<MySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/songs/mine");
      if (!res.ok) return;
      const data = await res.json();
      setSongs(Array.isArray(data) ? data : []);
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

  // Enquanto houver música em processamento, faz polling — mesmo mecanismo
  // usado em /upload, mas aqui cobre todas as músicas do usuário de uma vez.
  useEffect(() => {
    const hasPending = songs.some(s => PENDING_STATUSES.has(s.processingStatus));
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(load, 4000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs]);

  const isPro = isProRole(session?.user?.role);
  const tier = roleLabel(session?.user?.role);
  const readySongs = songs.filter(s => s.processingStatus === "ready");

  // ── Ações ────────────────────────────────────────────────────────────────
  async function toggleShare(song: MySong) {
    setBusyId(song.id);
    try {
      const res = await fetch(`/api/songs/${song.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: !song.shared }),
      });
      if (res.ok) {
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, shared: !s.shared } : s));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? t("errShare"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(id: number, values: EditValues) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, bpm: Number(values.bpm) }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSongs(prev => prev.map(s => s.id === id ? { ...s, ...d } : s));
        setEditingId(null);
      } else {
        alert(d.error ?? t("errSave"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(song: MySong) {
    if (song.shared) {
      alert(t("errDeleteShared"));
      return;
    }
    if (!confirm(t("confirmDelete", { title: song.title }))) return;
    setBusyId(song.id);
    try {
      const res = await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
      if (res.ok) {
        setSongs(prev => prev.filter(s => s.id !== song.id));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? t("errDelete"));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      {status === "loading" ? null : !session?.user ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>{t("signedOut")}</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>{tc("signIn")}</Link>
        </div>
      ) : (
        <>
          {/* Cabeçalho do perfil */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "var(--surface3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              fontWeight: 700, color: "var(--text)", flexShrink: 0,
            }}>
              {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontWeight: 900, fontSize: 22, margin: "0 0 2px", color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                {session.user.name ?? t("myProfile")}
                {isPro ? (
                  <span className="pro-badge">{tier}</span>
                ) : (
                  <span style={{
                    background: "var(--surface3)", color: "var(--muted)",
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                    padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border2)",
                  }}>{tier}</span>
                )}
              </h1>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{session.user.email}</p>
            </div>
          </div>

          {/* Minhas músicas */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 16 }}>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 17, margin: "0 0 2px", color: "var(--text)" }}>{t("heading")}</h2>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{t("subtitle")}</p>
            </div>
            <Link href="/upload" className="btn-primary" style={{ padding: "9px 18px", fontSize: 13, whiteSpace: "nowrap" }}>
              {t("uploadTrack")}
            </Link>
          </div>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>{tc("loading")}</p>
          ) : readySongs.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px", fontStyle: "italic" }}>
                {t("empty")}
              </p>
              <Link href="/upload" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>{t("uploadCta")}</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {readySongs.map(s => (
                <SongCard
                  key={s.id}
                  song={s}
                  editing={editingId === s.id}
                  busy={busyId === s.id}
                  onEdit={() => setEditingId(s.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(v) => saveEdit(s.id, v)}
                  onToggleShare={() => toggleShare(s)}
                  onRemove={() => remove(s)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Card de uma música ──────────────────────────────────────────────────────
type EditValues = { title: string; artist: string; genre: string; key: string; bpm: string; thumbnailUrl?: string | null };

const THUMB_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const THUMB_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function SongCard({
  song, editing, busy, onEdit, onCancelEdit, onSave, onToggleShare, onRemove,
}: {
  song: MySong;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (v: EditValues) => void;
  onToggleShare: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("mySongs");
  const tc = useTranslations("common");
  const [form, setForm] = useState<EditValues>({
    title: song.title, artist: song.artist, genre: song.genre, key: song.key, bpm: String(song.bpm),
  });
  const [thumbUrl, setThumbUrl] = useState<string | null>(song.thumbnailUrl);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ title: song.title, artist: song.artist, genre: song.genre, key: song.key, bpm: String(song.bpm) });
      setThumbUrl(song.thumbnailUrl);
      setThumbError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Troca de capa: presign → PUT direto no R2 → guarda a publicUrl (só grava
  // no banco quando o usuário clicar em Salvar, junto do resto do formulário).
  async function handleThumbFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reescolher o mesmo arquivo
    if (!file) return;
    setThumbError("");
    if (!THUMB_TYPES.has(file.type)) {
      setThumbError("Use JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > THUMB_MAX_BYTES) {
      setThumbError(t("errImageTooBig"));
      return;
    }
    setUploadingThumb(true);
    try {
      const presign = await fetch(`/api/songs/${song.id}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const pd = await presign.json().catch(() => ({}));
      if (!presign.ok) { setThumbError(pd.error ?? "Falha ao preparar upload."); return; }

      const put = await fetch(pd.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) { setThumbError(t("errThumbUpload")); return; }

      setThumbUrl(pd.publicUrl);
    } catch {
      setThumbError(t("errConnection"));
    } finally {
      setUploadingThumb(false);
    }
  }

  const iconBtn: React.CSSProperties = {
    background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8,
    padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer",
    color: "var(--text)", opacity: busy ? 0.5 : 1, whiteSpace: "nowrap",
  };

  const field = (label: string, key: keyof EditValues, opts?: { width?: number; type?: string }) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: opts?.width ? `0 0 ${opts.width}px` : 1, minWidth: 0 }}>
      <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600 }}>{label}</span>
      <input
        value={form[key] ?? ""}
        type={opts?.type ?? "text"}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--text)", width: "100%" }}
      />
    </label>
  );

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
      {/* Linha principal */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link href={{ pathname: "/song/[slug]", params: { slug: song.slug } }} style={{ minWidth: 0, color: "inherit", flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
            {song.title}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em",
              background: song.shared ? "rgba(255,154,0,0.15)" : "var(--surface3)",
              color: song.shared ? "var(--accent)" : "var(--muted2)",
            }}>
              {song.shared ? "● COMPARTILHADA" : "PRIVADA"}
            </span>
          </p>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            {song.artist} · {song.key} · {song.bpm} BPM · Enviada em {formatDate(song.createdAt)}
          </p>
        </Link>

        {!editing && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={onToggleShare} disabled={busy} style={{
              ...iconBtn,
              background: song.shared ? "rgba(255,154,0,0.12)" : "var(--surface2)",
              borderColor: song.shared ? "rgba(255,154,0,0.35)" : "var(--border2)",
              color: song.shared ? "var(--accent)" : "var(--text)",
            }}>
              {song.shared ? "Descompartilhar" : "Compartilhar"}
            </button>
            <button onClick={onEdit} disabled={busy} style={iconBtn}>{t("editBtn")}</button>
            <button
              onClick={onRemove}
              disabled={busy || song.shared}
              title={song.shared ? t("unshareFirst") : t("deleteTitle")}
              style={{
                ...iconBtn,
                cursor: (busy || song.shared) ? "not-allowed" : "pointer",
                opacity: (busy || song.shared) ? 0.4 : 1,
                color: "var(--danger)", borderColor: "var(--border2)",
              }}
            >
              {t("deleteBtn")}
            </button>
          </div>
        )}
      </div>

      {/* Form de edição */}
      {editing && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Capa / thumbnail */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 10, overflow: "hidden", flexShrink: 0,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
            }}>
              {thumbUrl
                ? <Image src={thumbUrl} alt="Capa" width={64} height={64} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                : "🎸"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600 }}>{t("cover")}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleThumbFile}
                  style={{ display: "none" }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || uploadingThumb} style={iconBtn}>
                  {uploadingThumb ? tc("sending") : (thumbUrl ? t("changeImage") : t("addImage"))}
                </button>
                {thumbUrl && !uploadingThumb && (
                  <button type="button" onClick={() => setThumbUrl(null)} disabled={busy}
                    style={{ ...iconBtn, color: "var(--danger)" }}>
                    {tc("remove")}
                  </button>
                )}
              </div>
              {thumbError && <span style={{ color: "var(--danger)", fontSize: 12 }}>{thumbError}</span>}
              <span style={{ color: "var(--muted2)", fontSize: 11 }}>{t("coverHint")}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {field(t("fieldTitle"), "title")}
            {field("Artista", "artist")}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {field(t("fieldGenre"), "genre")}
            {field(t("keyAria"), "key", { width: 90 })}
            {field("BPM", "bpm", { width: 90, type: "number" })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onCancelEdit} disabled={busy} style={iconBtn}>{tc("cancel")}</button>
            <button
              onClick={() => onSave({ ...form, thumbnailUrl: thumbUrl })}
              disabled={busy || uploadingThumb}
              className="btn-primary"
              style={{ padding: "7px 18px", fontSize: 13, opacity: (busy || uploadingThumb) ? 0.6 : 1 }}
            >
              {busy ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
