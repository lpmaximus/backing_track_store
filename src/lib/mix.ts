/**
 * Resolução da mixagem em três camadas (Fase S2 / ADR-BTS-005, D5).
 *
 * Módulo PURO — não toca o banco. Pode ser importado no client, nas rotas e,
 * mais adiante, no modo palco (S3). Quem chama traz as linhas já lidas.
 *
 * As três camadas, aplicadas nesta ordem, cada uma sobrescrevendo a anterior:
 *
 *   1. PADRÃO DO SETLIST   — o que o líder montou na aba Mixagem.
 *   2. AUTO-MUTE           — o instrumento do próprio integrante entra mutado.
 *                            É derivado de band_members.instrument; não tem
 *                            tabela.
 *   3. OVERRIDE PESSOAL    — o ajuste que o integrante salvou naquela música.
 *
 * ATENÇÃO — dois modos opostos, de propósito (decisão de 25/07/2026):
 *   · TOCAR JUNTO (aqui, camada 2): muta a SUA trilha, você faz a sua parte
 *     junto com o resto da banda. É o uso central do produto.
 *   · OUVIR COMO É (?solo= na página da música, anterior a este módulo):
 *     isola a SUA trilha e muta as outras, para aprender a parte de ouvido.
 * O ADR-BTS-005 §5.3 dizia que a camada 2 "reaproveita a lógica do ?solo=" —
 * está errado: ela faz o INVERSO. Os dois convivem; quem decide é a origem do
 * link (▶ Estudar do ensaio → isolar; abrir pelo setlist → tocar junto).
 *
 * Por que devolver a ORIGEM de cada stem, e não só o valor final: sem isso a
 * interface não consegue explicar por que a bateria sumiu, e o suporte recebe
 * "sumiu a bateria" toda semana. O campo `source` existe para virar o texto
 * "Bateria mutada — é o seu instrumento · desfazer".
 */

export type MixState = "on" | "mute" | "solo";

/** De onde veio o estado final daquele stem. */
export type MixSource = "default" | "setlist" | "auto" | "user";

export type MixRow = { stemKey: string; state: string; volume: number };

export type ResolvedStem = {
  stemKey: string;
  state: MixState;
  volume: number; // 0–100
  source: MixSource;
};

const DEFAULT_STATE: MixState = "on";
const DEFAULT_VOLUME = 100;

function asState(v: string): MixState {
  return v === "mute" || v === "solo" ? v : "on";
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Resolve o mix efetivo de UMA música.
 *
 * @param stemKeys      stems que a música realmente tem (vindos da tabela stems)
 * @param setlistMix    camada 1 — linhas de setlist_song_mix daquela música
 * @param myInstrument  camada 2 — instrumento do usuário na banda, ou null
 * @param userMix       camada 3 — linhas de setlist_song_mix_user do usuário
 */
export function resolveMix(
  stemKeys: string[],
  setlistMix: MixRow[] = [],
  myInstrument: string | null = null,
  userMix: MixRow[] = [],
): ResolvedStem[] {
  const byKeySetlist = new Map(setlistMix.map((r) => [r.stemKey, r]));
  const byKeyUser = new Map(userMix.map((r) => [r.stemKey, r]));

  return stemKeys.map((stemKey) => {
    let state: MixState = DEFAULT_STATE;
    let volume = DEFAULT_VOLUME;
    let source: MixSource = "default";

    // 1. padrão do setlist
    const s = byKeySetlist.get(stemKey);
    if (s) {
      state = asState(s.state);
      volume = clampVolume(s.volume);
      source = "setlist";
    }

    // 2. auto-mute do meu instrumento — só quando o líder não mandou o
    //    contrário explicitamente com um solo naquele stem.
    if (myInstrument && stemKey === myInstrument && state !== "solo") {
      state = "mute";
      source = "auto";
    }

    // 3. override pessoal — a palavra final é sempre do dono do fone.
    const u = byKeyUser.get(stemKey);
    if (u) {
      state = asState(u.state);
      volume = clampVolume(u.volume);
      source = "user";
    }

    return { stemKey, state, volume, source };
  });
}

/**
 * Texto curto que explica por que o stem está como está. Devolve null quando
 * não há nada a explicar (estado natural), para a interface não poluir.
 */
export function explainStem(r: ResolvedStem, label: string): string | null {
  if (r.source === "auto") return `${label} mutado — é o seu instrumento`;
  if (r.source === "setlist" && r.state === "mute") return `${label} mutado pelo líder`;
  if (r.source === "setlist" && r.state === "solo") return `${label} em solo pelo líder`;
  return null;
}

/** Velocidade guardada como numeric volta do driver como string. */
export function parseSpeed(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v ?? 1);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(0.5, Math.min(1.5, n));
}

/** Semitons aceitos pelo player (o pitch shift degrada fora disso). */
export function clampTranspose(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-6, Math.min(6, Math.round(n)));
}

export const MIX_STATES: MixState[] = ["on", "mute", "solo"];

/**
 * Duração total do setlist em segundos: soma das músicas mais os intervalos
 * entre elas. O intervalo da ÚLTIMA música não conta — depois dela não há
 * próxima, e somar daria um set mais longo do que o real.
 */
export function totalDuration(items: { duration: number; gapSeconds?: number }[]): number {
  return items.reduce((acc, it, i) => {
    const gap = i < items.length - 1 ? (it.gapSeconds ?? 0) : 0;
    return acc + (it.duration || 0) + gap;
  }, 0);
}

/** "1h 12min" / "45min" — formato de quem monta um set, não de player. */
export function formatDuration(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
