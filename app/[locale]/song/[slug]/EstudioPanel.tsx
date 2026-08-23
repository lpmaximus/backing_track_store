"use client";

/**
 * Pegar a música para a sua área, e configurar a SUA versão dela.
 *
 * Nada de áudio é copiado: a versão é uma folha de configuração por cima da
 * mesma base. Renomear e desligar faixa vale só para você — a música do
 * catálogo não muda para mais ninguém, e é isso que permite pegar qualquer
 * música compartilhada sem afetar quem a enviou.
 *
 * "Devolver" apaga só a configuração. As gravações continuam guardadas (elas
 * pertencem ao par usuário+música, não à versão) e reaparecem se a pessoa
 * pegar a música de novo.
 */

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { Stem } from "./WavePlayer";
import type { TrackCuts } from "@/src/lib/cuts";

export type Versao = {
  id: number;
  songId: number;
  title: string;
  disabledStems: string[];
  /**
   * Trechos apagados por faixa NESTA versão — ver src/lib/cuts.ts. Opcional
   * porque respostas antigas (e o objeto otimista de quem acabou de pegar a
   * música) não trazem o campo; ausente é o mesmo que "nenhum corte".
   */
  trackCuts?: TrackCuts;
};

type Props = {
  songId: number;
  stems: Stem[];
  version: Versao | null;
  onChange: (v: Versao | null) => void;
  /** Rótulo já traduzido de cada instrumento, para não repetir o mapa daqui. */
  labelDoStem: (instrument: string, fallback: string | null) => string;
};

export default function EstudioPanel({ songId, stems, version, onChange, labelDoStem }: Props) {
  const t = useTranslations("studio");
  const [ocupado, setOcupado] = useState(false);

  const pegar = useCallback(async () => {
    setOcupado(true);
    try {
      const res = await fetch("/api/estudio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        const d = (await res.json()) as { version: Versao };
        onChange(d.version);
      }
    } finally {
      setOcupado(false);
    }
  }, [songId, onChange]);

  const devolver = useCallback(async () => {
    if (!version) return;
    if (!confirm(t("confirmRemove", { name: version.title }))) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/estudio/${version.id}`, { method: "DELETE" });
      if (res.ok) onChange(null);
    } finally {
      setOcupado(false);
    }
  }, [version, onChange, t]);

  const renomear = useCallback(async (novo: string) => {
    if (!version) return;
    const limpo = novo.trim().slice(0, 255);
    if (limpo === version.title) return;
    const res = await fetch(`/api/estudio/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: limpo }),
    });
    if (res.ok) {
      const d = (await res.json()) as { version: Versao };
      onChange(d.version);
    }
  }, [version, onChange]);

  const alternarFaixa = useCallback(async (instrument: string) => {
    if (!version) return;
    const desligadas = version.disabledStems.includes(instrument)
      ? version.disabledStems.filter(s => s !== instrument)
      : [...version.disabledStems, instrument];

    // A API recusa desligar tudo; conferimos aqui também para o clique não
    // parecer que não fez nada — a última faixa ligada simplesmente não desliga.
    if (desligadas.length >= stems.length) return;

    const anterior = version;
    onChange({ ...version, disabledStems: desligadas });
    const res = await fetch(`/api/estudio/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabledStems: desligadas }),
    });
    if (!res.ok) onChange(anterior);
  }, [version, stems.length, onChange]);

  const caixa: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
    marginTop: 16,
  };

  if (!version) {
    return (
      <div style={{ ...caixa, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            {t("title")}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("tracksHelp")}
          </p>
        </div>
        <button
          onClick={pegar}
          disabled={ocupado}
          style={{
            padding: "9px 20px", borderRadius: 500, fontSize: 14, fontWeight: 700, cursor: "pointer",
            background: "var(--accent)", color: "#000", border: "none", opacity: ocupado ? 0.6 : 1,
          }}
        >
          {t("take")}
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...caixa, opacity: ocupado ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 500,
          background: "var(--accent)", color: "#000",
        }}>
          {t("taken")}
        </span>
        <input
          defaultValue={version.title}
          onBlur={e => renomear(e.target.value)}
          maxLength={255}
          aria-label={t("nameLabel")}
          style={{
            flex: "1 1 200px", minWidth: 160, padding: "7px 10px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
          }}
        />
        <button
          onClick={devolver}
          style={{
            padding: "7px 14px", borderRadius: 500, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--muted)",
          }}
        >
          {t("remove")}
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
        {t("tracksTitle")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {stems.map(s => {
          const ligada = !version.disabledStems.includes(s.instrument);
          return (
            <button
              key={s.id}
              onClick={() => alternarFaixa(s.instrument)}
              aria-pressed={ligada}
              style={{
                padding: "6px 13px", borderRadius: 500, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: ligada ? "var(--surface2)" : "transparent",
                border: `1px solid ${ligada ? "var(--border2)" : "var(--border)"}`,
                color: ligada ? "var(--text)" : "var(--muted2)",
                textDecoration: ligada ? "none" : "line-through",
              }}
            >
              {labelDoStem(s.instrument, s.label)}
            </button>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>
        {t("tracksHelp")}
      </p>
    </div>
  );
}
