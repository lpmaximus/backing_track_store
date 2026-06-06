"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Song = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  cifraText: string | null;
  published: boolean;
  createdAt: string;
};

const EMPTY_SONG: Omit<Song, "id" | "createdAt"> = {
  slug: "",
  title: "",
  artist: "",
  genre: "Rock",
  key: "C",
  bpm: 120,
  audioUrl: null,
  thumbnailUrl: null,
  duration: 180,
  cifraText: null,
  published: true,
};

const GENRES = ["Rock", "Pop", "MPB", "Bossa Nova", "Samba", "Jazz", "Forró", "Funk", "Sertanejo", "Gospel", "Reggae", "Blues", "Outro"];
const KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  const [songs, setSongs] = useState<Song[]>([]);
  const [editing, setEditing] = useState<Partial<Song> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"list" | "edit">("list");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const adminHeaders = {
    "Content-Type": "application/json",
    "x-admin-password": password,
  };

  const authenticate = async () => {
    if (!password) { setAuthError("Digite a senha"); return; }
    // Testa a senha com um PUT sem ID (retorna 400 se auth ok, 401 se senha errada)
    const res = await fetch("/api/songs?id=0", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({}),
    });
    if (res.status !== 401) {
      setAuthenticated(true);
      setAuthError("");
      fetchSongs();
    } else {
      setAuthError("Senha incorreta");
    }
  };

  const fetchSongs = async () => {
    const res = await fetch("/api/songs");
    const data = await res.json();
    setSongs(Array.isArray(data) ? data : []);
  };

  const newSong = () => {
    setEditing({ ...EMPTY_SONG });
    setTab("edit");
  };

  const editSong = (song: Song) => {
    setEditing({ ...song });
    setTab("edit");
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setEditing((prev) => {
      const updated = { ...prev, [field]: value } as Partial<Song>;
      if ((field === "title" || field === "artist") && !prev?.id) {
        const t = field === "title" ? String(value) : String(prev?.title ?? "");
        const a = field === "artist" ? String(value) : String(prev?.artist ?? "");
        updated.slug = slugify(`${t}-${a}`);
      }
      return updated;
    });
  };

  const uploadAudio = async (file: File) => {
    if (!file) return;
    setUploadingAudio(true);
    setMessage("⏳ Fazendo upload...");
    try {
      const key = `audio/${editing?.slug || slugify(file.name.replace(/\.[^/.]+$/, ""))}/${file.name}`;
      const urlRes = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ key, contentType: file.type || "audio/mpeg" }),
      });
      const { uploadUrl, publicUrl, error } = await urlRes.json();
      if (error) { setMessage(`❌ ${error}`); setUploadingAudio(false); return; }

      // Upload direto para o R2
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });

      handleChange("audioUrl", publicUrl);
      setMessage("✅ Áudio enviado para o R2!");
    } catch (e) {
      setMessage("❌ Erro no upload. Verifique as variáveis R2.");
      console.error(e);
    }
    setUploadingAudio(false);
  };

  const uploadThumbnail = async (file: File) => {
    if (!file) return;
    setUploadingThumb(true);
    setMessage("⏳ Enviando imagem...");
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const slug = editing?.slug || slugify((editing?.title ?? "") + "-" + (editing?.artist ?? ""));
      const key = `images/${slug}.${ext}`;
      const urlRes = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ key, contentType: file.type || "image/jpeg" }),
      });
      const { uploadUrl, publicUrl, error } = await urlRes.json();
      if (error) { setMessage(`❌ ${error}`); setUploadingThumb(false); return; }

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });

      handleChange("thumbnailUrl", publicUrl);
      setMessage("✅ Imagem enviada!");
    } catch (e) {
      setMessage("❌ Erro no upload da imagem.");
      console.error(e);
    }
    setUploadingThumb(false);
  };

  const save = async () => {
    if (!editing?.title || !editing?.artist) {
      setMessage("❌ Preencha título e artista.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const isNew = !editing.id;
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/songs" : `/api/songs?id=${editing.id}`;
      const res = await fetch(url, {
        method,
        headers: adminHeaders,
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Salvo com sucesso!");
        fetchSongs();
        setTimeout(() => { setTab("list"); setEditing(null); setMessage(""); }, 1200);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("❌ Erro de rede.");
    }
    setSaving(false);
  };

  const deleteSong = async (id: number) => {
    if (!confirm("Deletar esta música?")) return;
    const res = await fetch(`/api/songs?id=${id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json();
    if (data.success) fetchSongs();
  };

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 40, maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Admin</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>BackingTrack.store</p>
          <input
            type="password"
            placeholder="Senha de acesso"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "10px 16px", borderRadius: 8, width: "100%", marginBottom: 12, fontSize: 15 }}
          />
          {authError && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{authError}</p>}
          <button
            onClick={authenticate}
            style={{ background: "#f59e0b", color: "#000", border: "none", padding: "12px 0", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: "pointer", width: "100%" }}
          >
            Entrar
          </button>
          <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 16 }}>
            Senha padrão: <code style={{ background: "var(--surface2)", padding: "1px 6px", borderRadius: 4 }}>backingtrack2026</code>
            <br />Mude via env var <code>ADMIN_PASSWORD</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" style={{ color: "var(--muted)", fontSize: 22 }} className="hover:opacity-70">←</Link>
          <h1 style={{ color: "var(--text)", fontWeight: 800, fontSize: 18, flex: 1 }}>Admin Panel</h1>
          <button
            onClick={newSong}
            style={{ background: "#f59e0b", color: "#000", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + Nova Música
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          {(["list", "edit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? "#f59e0b" : "transparent",
                color: tab === t ? "#000" : "var(--muted)",
                border: "none",
                padding: "6px 16px",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t === "list" ? `📋 Músicas (${songs.length})` : (editing?.id ? "✏️ Editar" : "➕ Nova")}
            </button>
          ))}
        </div>

        {/* List */}
        {tab === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {songs.length === 0 && (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Nenhuma música ainda. Clique em "+ Nova Música".</p>
            )}
            {songs.map((song) => (
              <div
                key={song.id}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {song.thumbnailUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={song.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (song.audioUrl ? "🎵" : "🎸")
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>{song.title}</p>
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>{song.artist} · {song.genre} · {song.key} · {song.bpm} BPM</p>
                  {!song.audioUrl && (
                    <p style={{ color: "#f59e0b", fontSize: 12 }}>⚠ Sem base de áudio</p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Link
                    href={`/song/${song.slug}`}
                    target="_blank"
                    style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 6, fontSize: 12 }}
                  >
                    Ver
                  </Link>
                  <button
                    onClick={() => editSong(song)}
                    style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteSong(Number(song.id))}
                    style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444433", padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit/New Form */}
        {tab === "edit" && editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {message && (
              <div style={{ background: message.startsWith("✅") ? "#10b98122" : "#ef444422", border: `1px solid ${message.startsWith("✅") ? "#10b98144" : "#ef444444"}`, borderRadius: 8, padding: "10px 16px", color: message.startsWith("✅") ? "#10b981" : "#ef4444", fontSize: 14 }}>
                {message}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>TÍTULO *</label>
                <input
                  value={editing.title ?? ""}
                  onChange={(e) => handleChange("title", e.target.value)}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                  placeholder="Ex: Garota de Ipanema"
                />
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>ARTISTA *</label>
                <input
                  value={editing.artist ?? ""}
                  onChange={(e) => handleChange("artist", e.target.value)}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                  placeholder="Ex: Tom Jobim"
                />
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>GÊNERO</label>
                <select
                  value={editing.genre ?? "Rock"}
                  onChange={(e) => handleChange("genre", e.target.value)}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                >
                  {GENRES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>TOM</label>
                <select
                  value={editing.key ?? "C"}
                  onChange={(e) => handleChange("key", e.target.value)}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                >
                  {KEYS.map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>BPM</label>
                <input
                  type="number"
                  value={editing.bpm ?? 120}
                  onChange={(e) => handleChange("bpm", Number(e.target.value))}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>THUMBNAIL (imagem)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {editing.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.thumbnailUrl} alt="thumb" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />
                  )}
                  <input
                    value={editing.thumbnailUrl ?? ""}
                    onChange={(e) => handleChange("thumbnailUrl", e.target.value)}
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, flex: 1, fontSize: 13, fontFamily: "monospace" }}
                    placeholder="https://pub-xxx.r2.dev/images/..."
                  />
                  <label style={{ background: uploadingThumb ? "var(--surface2)" : "#3b82f622", color: uploadingThumb ? "var(--muted)" : "#3b82f6", border: "1px solid #3b82f644", padding: "9px 14px", borderRadius: 8, fontSize: 13, cursor: uploadingThumb ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {uploadingThumb ? "⏳..." : "🖼 Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={uploadingThumb}
                      onChange={(e) => e.target.files?.[0] && uploadThumbnail(e.target.files[0])}
                    />
                  </label>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Foto do artista ou capa da música (JPG/PNG). Recomendado: 400×400px.</p>
              </div>
              <div>
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>ÁUDIO (R2)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={editing.audioUrl ?? ""}
                    onChange={(e) => handleChange("audioUrl", e.target.value)}
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, flex: 1, fontSize: 13, fontFamily: "monospace" }}
                    placeholder="https://pub-xxx.r2.dev/audio/..."
                  />
                  <label style={{ background: uploadingAudio ? "var(--surface2)" : "#f59e0b22", color: uploadingAudio ? "var(--muted)" : "#f59e0b", border: "1px solid #f59e0b44", padding: "9px 14px", borderRadius: 8, fontSize: 13, cursor: uploadingAudio ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {uploadingAudio ? "⏳..." : "⬆ Upload"}
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      disabled={uploadingAudio}
                      onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])}
                    />
                  </label>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Upload envia direto para o Cloudflare R2 (sem passar pelo Vercel).</p>
              </div>
            </div>

            <div>
              <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                SLUG (URL)
              </label>
              <input
                value={editing.slug ?? ""}
                onChange={(e) => handleChange("slug", e.target.value)}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 13, fontFamily: "monospace" }}
              />
            </div>

            <div>
              <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
                CIFRA (Cole o texto da cifra)
              </label>
              <textarea
                value={editing.cifraText ?? ""}
                onChange={(e) => handleChange("cifraText", e.target.value)}
                rows={16}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "12px", borderRadius: 8, width: "100%", fontSize: 13, fontFamily: "Courier New, monospace", lineHeight: 1.8, resize: "vertical" }}
                placeholder={`[Verso]\nAm   G\nLetra da música...\n\n[Refrão]\nC   F   G\nRefrão aqui...`}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setTab("list"); setEditing(null); setMessage(""); }}
                style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", padding: "10px 20px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{ background: "#f59e0b", color: "#000", border: "none", padding: "10px 28px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Salvando..." : "💾 Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
