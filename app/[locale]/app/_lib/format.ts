/** Formatação de data/hora das telas do app — sempre no fuso de Brasília. */
export const APP_TZ = "America/Sao_Paulo";

export function dateParts(d: Date, locale: string) {
  const loc = locale === "en" ? "en-US" : "pt-BR";
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { timeZone: APP_TZ, ...o }).format(d);
  return {
    dow: fmt({ weekday: "short" }).replace(".", "").toUpperCase(),
    day: fmt({ day: "numeric" }),
    month: fmt({ month: "short" }).replace(".", "").toUpperCase(),
    time: fmt({ hour: "2-digit", minute: "2-digit" }),
  };
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Chave i18n (namespace "bands") do rótulo do instrumento salvo no banco. */
export const INSTRUMENT_KEY: Record<string, string> = {
  drums: "instrumentDrums",
  bass: "instrumentBass",
  guitar: "instrumentGuitar",
  harmony: "instrumentHarmony",
  vocal: "instrumentVocals",
  melody: "instrumentMelody",
};

/** Link de notificação/convite do site → equivalente dentro do app, quando existe. */
export function toAppPath(link: string | null | undefined): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;
  const m = link.match(/^\/(?:en\/)?song\/([^/?#]+)/);
  if (m) return `/app/song/${m[1]}`;
  const s = link.match(/^\/(?:en\/)?setlists\/(\d+)\/?$/);
  if (s) return `/app/setlists/${s[1]}`;
  if (/^\/(?:en\/)?(bandas|bands)\/?$/.test(link)) return "/app/bandas";
  return link;
}

const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_INDEX: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

/** Tom combinado no setlist: "G" + 2 → "A"; "Am" − 1 → "G#m". Desconhecido → igual. */
export function transposeKey(key: string, semitones: number): string {
  if (!semitones) return key;
  const m = key.trim().match(/^([A-G](?:#|b)?)(.*)$/);
  if (!m || NOTE_INDEX[m[1]] === undefined) return key;
  const idx = (NOTE_INDEX[m[1]] + semitones + 120) % 12;
  return NOTES_SHARP[idx] + m[2];
}
