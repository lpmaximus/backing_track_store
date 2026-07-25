"use client";

/**
 * Aba Mixagem — a tela única do setlist (Fase S2 / ADR-BTS-005).
 *
 * Uma linha por música, uma coluna por stem, mais tom, velocidade e intervalo.
 * O ponto é bater o olho no setlist inteiro sem abrir vinte páginas de música;
 * por isso é grade, com rolagem horizontal no celular, e não acordeão.
 *
 * Duas camadas de escrita convivem aqui (D5):
 *   · líder      → mixagem PADRÃO do setlist, que vale para a banda toda
 *   · integrante → o próprio override, que só ele ouve
 * O seletor no topo diz em qual das duas se está mexendo, porque um clique
 * errado aqui muda o que a banda inteira escuta.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  resolveMix,
  totalDuration,
  formatDuration,
  type MixState,
  type ResolvedStem,
} from "@/src/lib/mix";

type Item = {
  setlistSongId: number;
  position: number;
  transposeSemitones: number;
  speed: string | number;
  gapSeconds: number;
  songId: number;
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  duration: number;
};

type MixRow = { setlistSongId: number; stemKey: string; state: string; volume: number };

type Payload = {
  role: "leader" | "member";
  viewerInstrument: string | null;
  items: Item[];
  stemsBySong: Record<number, string[]>;
  setlistMix: MixRow[];
  userMix: MixRow[];
};

const STEM_ORDER = ["vocal", "melody", "guitar", "harmony", "bass", "drums"];
const STEM_LABEL: Record<string, string> = {
  vocal: "Vocal",
  melody: "Melodia",
  guitar: "Guitarra",
  harmony: "Harmonia",
  bass: "Baixo",
  drums: "Bateria",
};
const STEM_ICON: Record<string, string> = {
  vocal: "🎤", melody: "🎺", guitar: "🎸", harmony: "🎹", bass: "🎸", drums: "🥁",
};

function fmtSemitones(n: number) {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

const cellBtn = (active: boolean, color: string) => ({
  width: 24,
  height: 24,
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 700 as const,
  cursor: "pointer",
  background: active ? color : "var(--surface2)",
  border: `1px solid ${active ? color : "var(--border2)"}`,
  color: active ? "#fff" : "var(--muted)",
});

export default function SetlistMixer({ setlistId }: { setlistId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"setlist" | "user">("setlist");
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/setlists/${setlistId}/mix`);
      if (res.ok) {
        const d: Payload = await res.json();
        setData(d);
        // Integrante não edita o padrão do setlist — já abre no próprio mix.
        if (d.role !== "leader") setScope("user");
      }
    } finally {
      setLoading(false);
    }
  }, [setlistId]);

  useEffect(() => {
    if (open && !data) load();
  }, [open, data, load]);

  const isLeader = data?.role === "leader";

  // Colunas da grade: só os stems que aparecem em ALGUMA música do setlist.
  const columns = useMemo(() => {
    if (!data) return [];
    const present = new Set<string>();
    for (const list of Object.values(data.stemsBySong)) for (const s of list) present.add(s);
    return STEM_ORDER.filter((s) => present.has(s));
  }, [data]);

  const resolvedByItem = useMemo(() => {
    const map = new Map<number, ResolvedStem[]>();
    if (!data) return map;
    for (const it of data.items) {
      const keys = data.stemsBySong[it.songId] ?? [];
      const ordered = STEM_ORDER.filter((k) => keys.includes(k));
      map.set(
        it.setlistSongId,
        resolveMix(
          ordered,
          data.setlistMix.filter((m) => m.setlistSongId === it.setlistSongId),
          data.viewerInstrument,
          data.userMix.filter((m) => m.setlistSongId === it.setlistSongId),
        ),
      );
    }
    return map;
  }, [data]);

  const total = useMemo(
    () => (data ? totalDuration(data.items.map((i) => ({ duration: i.duration, gapSeconds: i.gapSeconds }))) : 0),
    [data],
  );

  async function setStem(
    setlistSongId: number,
    stemKey: string,
    next: MixState,
    volume: number,
    source?: string,
  ) {
    // Desfazer o auto-mute tem de ir para a camada PESSOAL, não para o padrão
    // do setlist. O auto-mute é aplicado depois da camada 1 na resolução, então
    // gravar "on" no padrão não teria efeito visível — o botão pareceria
    // quebrado. E faz sentido: reativar a própria trilha é decisão de quem está
    // com o fone, não algo que muda o som da banda inteira.
    const targetScope = source === "auto" ? "user" : scope;

    const key = `${setlistSongId}:${stemKey}`;
    setSaving(key);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/mix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: targetScope, setlistSongId, stemKey, state: next, volume }),
      });
      if (res.ok) load();
    } finally {
      setSaving(null);
    }
  }

  async function patchSong(setlistSongId: number, patch: Record<string, number>) {
    const res = await fetch(`/api/setlists/${setlistId}/songs/${setlistSongId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) load();
  }

  async function resetMine(setlistSongId: number) {
    const res = await fetch(`/api/setlists/${setlistId}/mix?setlistSongId=${setlistSongId}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  return (
    <div style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: 0 }}>
          MIXAGEM DO SETLIST
        </p>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}
        >
          {open ? "Fechar" : "Abrir mesa"}
        </button>
      </div>

      {!open ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: "10px 0 0" }}>
          Ajuste mudo, solo, volume, tom e velocidade de todas as músicas numa tela só.
        </p>
      ) : loading ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: "14px 0 0" }}>Carregando...</p>
      ) : !data || data.items.length === 0 ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic", margin: "14px 0 0" }}>
          Adicione músicas ao repertório para montar a mixagem.
        </p>
      ) : (
        <>
          {/* Em qual camada estou mexendo — sem isso o líder muda o som da banda sem perceber. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", flexWrap: "wrap" }}>
            {isLeader && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setScope("setlist")}
                  style={{ padding: "5px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                    border: scope === "setlist" ? "1px solid var(--accent)" : "1px solid var(--border2)",
                    background: scope === "setlist" ? "rgba(255,154,0,0.12)" : "transparent",
                    color: scope === "setlist" ? "var(--accent)" : "var(--muted)" }}
                >
                  Padrão da banda
                </button>
                <button
                  onClick={() => setScope("user")}
                  style={{ padding: "5px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                    border: scope === "user" ? "1px solid var(--accent)" : "1px solid var(--border2)",
                    background: scope === "user" ? "rgba(255,154,0,0.12)" : "transparent",
                    color: scope === "user" ? "var(--accent)" : "var(--muted)" }}
                >
                  Só meu fone
                </button>
              </div>
            )}
            <span style={{ fontSize: 12, color: "var(--muted2)" }}>
              {scope === "setlist"
                ? "Você está editando o que a banda inteira vai ouvir."
                : "Você está editando só o seu fone. Ninguém mais é afetado."}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              {data.items.length} {data.items.length === 1 ? "música" : "músicas"} · {formatDuration(total)}
            </span>
          </div>

          {data.viewerInstrument && (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", padding: "8px 12px", background: "rgba(255,154,0,0.07)", border: "1px solid rgba(255,154,0,0.2)", borderRadius: 8 }}>
              🎧 Seu instrumento é <strong>{STEM_LABEL[data.viewerInstrument] ?? data.viewerInstrument}</strong>, então ele entra mutado automaticamente. A célula com ponto laranja é isso — clique para reativar.
            </p>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 700, fontSize: 11, position: "sticky", left: 0, background: "var(--surface)" }}>
                    Música
                  </th>
                  {columns.map((c) => (
                    <th key={c} style={{ padding: "6px 8px", color: "var(--muted)", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
                      {STEM_ICON[c]} {STEM_LABEL[c] ?? c}
                    </th>
                  ))}
                  <th style={{ padding: "6px 8px", color: "var(--muted)", fontWeight: 700, fontSize: 11 }}>Tom</th>
                  <th style={{ padding: "6px 8px", color: "var(--muted)", fontWeight: 700, fontSize: 11 }}>Vel.</th>
                  <th style={{ padding: "6px 8px", color: "var(--muted)", fontWeight: 700, fontSize: 11 }}>Intervalo</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => {
                  const resolved = resolvedByItem.get(it.setlistSongId) ?? [];
                  const byKey = new Map(resolved.map((r) => [r.stemKey, r]));
                  const hasMine = data.userMix.some((m) => m.setlistSongId === it.setlistSongId);
                  const spd = Number(it.speed) || 1;

                  return (
                    <tr key={it.setlistSongId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 10px", position: "sticky", left: 0, background: "var(--surface)", maxWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ color: "var(--muted2)", fontWeight: 700 }}>{i + 1}</span>
                          <span style={{ color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.title}
                          </span>
                        </div>
                        <div style={{ color: "var(--muted2)", fontSize: 11 }}>
                          {it.artist} · {it.key} · {it.bpm} BPM
                          {hasMine && (
                            <button
                              onClick={() => resetMine(it.setlistSongId)}
                              style={{ marginLeft: 6, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 11, fontWeight: 600, padding: 0 }}
                              title="Voltar ao mix definido pelo líder"
                            >
                              zerar meu mix
                            </button>
                          )}
                        </div>
                      </td>

                      {columns.map((c) => {
                        const r = byKey.get(c);
                        if (!r) {
                          return (
                            <td key={c} style={{ padding: "8px", textAlign: "center", color: "var(--muted2)" }}>–</td>
                          );
                        }
                        const busy = saving === `${it.setlistSongId}:${c}`;
                        return (
                          <td key={c} style={{ padding: "6px 8px", textAlign: "center", opacity: busy ? 0.5 : 1 }}>
                            <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 3 }}>
                              <button
                                onClick={() => setStem(it.setlistSongId, c, r.state === "mute" ? "on" : "mute", r.volume, r.source)}
                                style={cellBtn(r.state === "mute", "var(--danger)")}
                                title={r.source === "auto" ? "Mutado por ser o seu instrumento — reativar vale só no seu fone" : "Mudo"}
                              >
                                M
                              </button>
                              <button
                                onClick={() => setStem(it.setlistSongId, c, r.state === "solo" ? "on" : "solo", r.volume, r.source)}
                                style={cellBtn(r.state === "solo", "var(--pro)")}
                                title="Solo"
                              >
                                S
                              </button>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={r.volume}
                              onChange={(e) => setStem(it.setlistSongId, c, r.state, Number(e.target.value), r.source)}
                              style={{ width: 54 }}
                              aria-label={`Volume ${STEM_LABEL[c] ?? c} em ${it.title}`}
                            />
                            {r.source === "auto" && (
                              <div style={{ color: "var(--accent)", fontSize: 14, lineHeight: 1 }} title="Mutado automaticamente: é o seu instrumento">
                                •
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Tom, velocidade e intervalo são do repertório: só o líder. */}
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {isLeader ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
                            <button onClick={() => patchSong(it.setlistSongId, { transposeSemitones: it.transposeSemitones - 1 })}
                              style={{ ...cellBtn(false, ""), width: 20 }}>−</button>
                            <span style={{ minWidth: 22, color: it.transposeSemitones ? "var(--accent)" : "var(--muted)", fontWeight: 700 }}>
                              {fmtSemitones(it.transposeSemitones)}
                            </span>
                            <button onClick={() => patchSong(it.setlistSongId, { transposeSemitones: it.transposeSemitones + 1 })}
                              style={{ ...cellBtn(false, ""), width: 20 }}>+</button>
                          </div>
                        ) : (
                          <span style={{ color: it.transposeSemitones ? "var(--accent)" : "var(--muted2)" }}>{fmtSemitones(it.transposeSemitones)}</span>
                        )}
                      </td>

                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {isLeader ? (
                          <select
                            value={spd.toFixed(2)}
                            onChange={(e) => patchSong(it.setlistSongId, { speed: Number(e.target.value) })}
                            style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 11 }}
                          >
                            {["0.70", "0.80", "0.90", "1.00", "1.10", "1.20"].map((v) => (
                              <option key={v} value={v}>{Number(v).toFixed(2)}×</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: spd !== 1 ? "var(--accent)" : "var(--muted2)" }}>{spd.toFixed(2)}×</span>
                        )}
                      </td>

                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        {isLeader ? (
                          <select
                            value={String(it.gapSeconds)}
                            onChange={(e) => patchSong(it.setlistSongId, { gapSeconds: Number(e.target.value) })}
                            style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 11 }}
                          >
                            <option value="0">emenda</option>
                            <option value="3">3s</option>
                            <option value="5">5s</option>
                            <option value="10">10s</option>
                            <option value="20">20s</option>
                          </select>
                        ) : (
                          <span style={{ color: "var(--muted2)" }}>{it.gapSeconds === 0 ? "emenda" : `${it.gapSeconds}s`}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ color: "var(--muted2)", fontSize: 11, margin: "12px 0 0" }}>
            O que você ajustar aqui já vale ao abrir a música por este setlist. O intervalo só tem efeito no modo palco.
          </p>
        </>
      )}
    </div>
  );
}
