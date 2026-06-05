"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Song = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  audioFile: string;
  duration: number;
  cifra: string;
  createdAt: string;
};

const EMPTY_SONG: Omit<Song, "id" | "createdAt"> = {
  slug: "",
  title: "",
  artist: "",
  genre: "Rock",
  key: "C",
  bpm: 120,
  audioFile: "",
  duration: 180,
  cifra: "",
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

  const authenticate = () => {
    if (!password) { setAuthError("Digite a senha"); return; }
    setAuthenticated(true);
    setAuthError("");
    fetchSongs();
  };

  const fetchSongs = async () => {
    const res = await fetch("/api/songs");
    const data = await res.json();
    setSongs(data);
  };

  const newSong = () => {
    setEditing({ ...EMPTY_SONG });
    setTab("edit");
  };

  const editSong = (song: Song) => {
    setEditing({ ...song });
    setTab("edit");
  };

  const handleChange = (field: string, value: string | number) => {
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

  const save = async () => {
    if (!editing?.title || !editing?.artist) {
      setMessage("❌ Preencha título e artista.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, song: editing }),
      });
      const data = await res.json();
      if (data.success) {
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

  const deleteSong = async (id: string) => {
    if (!confirm("Deletar esta música?")) return;
    const res = await fetch("/api/songs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, id }),
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
                <div style={{ fontSize: 28, flexShrink: 0 }}>{song.audioFile ? "🎵" : "🎸"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>{song.title}</p>
                  <p style={{ color: "var(--muted)", fontSize: 13 }}>{song.artist} · {song.genre} · {song.key} · {song.bpm} BPM</p>
                  {!song.audioFile && (
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
                    onClick={() => deleteSong(song.id)}
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
                <label style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>ARQUIVO DE ÁUDIO</label>
                <input
                  value={editing.audioFile ?? ""}
                  onChange={(e) => handleChange("audioFile", e.target.value)}
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 12px", borderRadius: 8, width: "100%", fontSize: 14 }}
                  placeholder="Ex: garota-ipanema.mp3"
                />
                <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Coloque o arquivo em <code>/public/audio/</code></p>
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
                value={editing.cifra ?? ""}
                onChange={(e) => handleChange("cifra", e.target.value)}
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
