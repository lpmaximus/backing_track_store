"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

type Band = { id: number; name: string; isLeader: boolean; subscriptionId: number | null };
type Member = { id: number; userId: number | null; instrument: string | null; status: string; display: string; isLeader: boolean };

// valores batem com stems.instrument (chaves do modelo de 6 stems) — é o que
// faz a trilha-guia (?solo=) pré-mutar a faixa certa do integrante no player.
const INSTRUMENTS = [
  { value: "drums", label: "Bateria" },
  { value: "bass", label: "Baixo" },
  { value: "guitar", label: "Guitarra" },
  { value: "harmony", label: "Violão / Teclado / Harmonia" },
  { value: "vocal", label: "Vocal / Voz" },
  { value: "melody", label: "Melodia / Solo" },
];
const instLabel = (v: string | null) => INSTRUMENTS.find((i) => i.value === v)?.label ?? "—";

export default function BandasContent() {
  const { data: session, status } = useSession();
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteInstrument, setInviteInstrument] = useState("");

  const loadBands = useCallback(async () => {
    try {
      const res = await fetch("/api/bands");
      const data = await res.json();
      if (res.ok) setBands(data.bands ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    loadBands();
  }, [status, loadBands]);

  async function createBand(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) { setName(""); await loadBands(); }
    } finally {
      setCreating(false);
    }
  }

  const loadMembers = useCallback(async (bandId: number) => {
    const res = await fetch(`/api/bands/${bandId}`);
    const data = await res.json();
    if (res.ok) setMembers(data.members ?? []);
  }, []);

  async function openBand(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setInviteUrl("");
    await loadMembers(id);
  }

  async function makeInvite(bandId: number) {
    const res = await fetch(`/api/bands/${bandId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument: inviteInstrument || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteUrl(`${window.location.origin}${data.path}`);
      await loadMembers(bandId); // atualiza a lista sem apagar o link gerado
    }
  }

  async function setInstrument(bandId: number, memberId: number, instrument: string) {
    await fetch(`/api/bands/${bandId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument }),
    });
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, instrument } : m)));
  }

  async function removeMember(bandId: number, memberId: number) {
    if (!confirm("Remover este integrante?")) return;
    const res = await fetch(`/api/bands/${bandId}/members/${memberId}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 } as const;

  return (
    <div style={{ flex: 1, maxWidth: 820, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>Minhas bandas</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px" }}>Monte sua banda, convide integrantes e compartilhe setlists.</p>

      {status === "loading" ? null : !session?.user ? (
        <div style={{ ...card, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>Entre para criar e gerenciar bandas.</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>Entrar</Link>
        </div>
      ) : (
        <>
          <form onSubmit={createBand} style={{ ...card, padding: 16, marginBottom: 20, display: "flex", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da banda (ex: Ministério de Louvor)" maxLength={200}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <button type="submit" disabled={!name.trim() || creating} className="btn-primary" style={{ padding: "9px 20px", fontSize: 13, opacity: !name.trim() || creating ? 0.6 : 1 }}>
              {creating ? "Criando..." : "Criar banda"}
            </button>
          </form>

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Carregando...</p>
          ) : bands.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>Você ainda não tem bandas. Crie a primeira acima.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bands.map((b) => (
                <div key={b.id} style={card}>
                  <button onClick={() => openBand(b.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "none", border: "none", padding: "16px 20px", cursor: "pointer", color: "inherit", textAlign: "left" }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 2px" }}>{b.name}</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                        {b.isLeader ? "Você é o líder" : "Membro"} · {b.subscriptionId ? "Pro ativo" : "sem assinatura"}
                      </p>
                    </div>
                    <span style={{ color: "var(--muted2)", fontSize: 18 }}>{openId === b.id ? "▲" : "▼"}</span>
                  </button>

                  {openId === b.id && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "16px 20px" }}>
                      <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 12px" }}>INTEGRANTES</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                        {members.map((m) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.display} {m.isLeader && <span style={{ color: "var(--muted2)", fontSize: 11 }}>(líder)</span>}
                              {m.status === "invited" && <span style={{ color: "var(--muted2)", fontSize: 11 }}> · convidado</span>}
                            </span>
                            {b.isLeader ? (
                              <select value={m.instrument ?? ""} onChange={(e) => setInstrument(b.id, m.id, e.target.value)}
                                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 12 }}>
                                <option value="">instrumento</option>
                                {INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>{instLabel(m.instrument)}</span>
                            )}
                            {b.isLeader && !m.isLeader && (
                              <button onClick={() => removeMember(b.id, m.id)} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>remover</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {b.isLeader && (
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                          <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 10px" }}>CONVIDAR</p>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select value={inviteInstrument} onChange={(e) => setInviteInstrument(e.target.value)}
                              style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 13 }}>
                              <option value="">instrumento (opcional)</option>
                              {INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                            </select>
                            <button onClick={() => makeInvite(b.id)} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}>Gerar link</button>
                          </div>
                          {inviteUrl && (
                            <div style={{ marginTop: 10 }}>
                              <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 4px" }}>Envie este link para o integrante:</p>
                              <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--accent)", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
                              {/* QR para o integrante escanear no ensaio/culto, sem digitar (R2) */}
                              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ background: "#fff", padding: 8, borderRadius: 8, lineHeight: 0, flexShrink: 0 }}>
                                  <QRCodeSVG value={inviteUrl} size={104} level="M" />
                                </div>
                                <p style={{ color: "var(--muted2)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                                  Ou peça para o integrante <strong style={{ color: "var(--muted)" }}>escanear este QR</strong> com a câmera do celular — abre o convite direto, sem digitar.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
