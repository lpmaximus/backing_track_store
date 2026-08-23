/**
 * Efeitos das gravações do usuário (a "pedaleira" do take).
 *
 * Módulo PURO — só o catálogo e a validação. A construção dos nós de áudio
 * vive no WavePlayer, que é quem tem o Tone.js carregado. Separar assim
 * permite a rota validar o que chega sem arrastar uma biblioteca de áudio
 * para dentro do servidor.
 *
 * ── Por que preset, e não uma pedaleira com botões ──────────────────────────
 * O pedido foi "hall na voz, compressor no instrumento" — ou seja, um destino
 * sonoro, não o controle de cada parâmetro. Um punhado de presets bem ajustados
 * resolve isso; doze botões soltos transferem para o músico o trabalho de
 * descobrir combinações que já sabemos que funcionam. Se um dia fizer falta
 * abrir os parâmetros, o formato guardado (preset + intensidade) comporta a
 * evolução sem migração.
 *
 * ── Não destrutivo, de propósito ────────────────────────────────────────────
 * O efeito NÃO entra no arquivo. O que fica gravado é a captação limpa; isto
 * aqui é configuração de reprodução. Assim dá para trocar de ideia depois,
 * comparar duas versões e nunca perder o material original — que é o oposto de
 * "gravar com reverb" e descobrir tarde demais que exagerou.
 */

export type FxPresetId =
  | "none"
  | "studio"
  | "hall"
  | "room"
  | "vocal"
  | "comp"
  | "drive"
  | "chorus"
  | "delay";

export type TakeFx = {
  preset: FxPresetId;
  /** 0–1. Em reverb/delay é o quanto do efeito se mistura ao seco; em
   *  compressor e drive, o quanto da correção é aplicada. */
  mix: number;
};

export const FX_DEFAULT: TakeFx = { preset: "none", mix: 0.3 };

/** Para qual fonte cada preset foi ajustado — só orienta a lista na tela. */
export type FxCategoria = "voz" | "instrumento" | "ambos";

export const FX_PRESETS: { id: FxPresetId; categoria: FxCategoria }[] = [
  { id: "none", categoria: "ambos" },
  // Cadeia completa de acabamento — o que separa "gravei no quarto" de "soa
  // produzido". Vem primeiro na lista porque é o que resolve a queixa mais
  // comum; os demais são efeito, este é tratamento.
  { id: "studio", categoria: "voz" },
  { id: "hall", categoria: "voz" },
  { id: "room", categoria: "voz" },
  { id: "vocal", categoria: "voz" },
  { id: "comp", categoria: "instrumento" },
  { id: "drive", categoria: "instrumento" },
  { id: "chorus", categoria: "instrumento" },
  { id: "delay", categoria: "ambos" },
];

const IDS = new Set<string>(FX_PRESETS.map(p => p.id));

export function isFxPreset(v: unknown): v is FxPresetId {
  return typeof v === "string" && IDS.has(v);
}

/**
 * Normaliza o que veio do cliente ou do banco. Valor inválido vira "sem
 * efeito" em vez de erro: uma configuração estranha não pode impedir a pessoa
 * de ouvir a própria gravação.
 */
export function sanitizeFx(v: unknown): TakeFx {
  if (!v || typeof v !== "object") return { ...FX_DEFAULT };
  const o = v as { preset?: unknown; mix?: unknown };
  const preset = isFxPreset(o.preset) ? o.preset : "none";
  const bruto = Number(o.mix);
  const mix = Number.isFinite(bruto) ? Math.max(0, Math.min(1, bruto)) : FX_DEFAULT.mix;
  return { preset, mix };
}

/** Nenhum nó no caminho — usado para pular a montagem da cadeia. */
export function fxVazio(fx: TakeFx | null | undefined): boolean {
  return !fx || fx.preset === "none" || fx.mix <= 0;
}
