/**
 * Lista canônica de gêneros musicais — fonte única para os <select> do app.
 *
 * Por que existe: o campo `songs.genre` é varchar livre e cada tela criava a
 * sua própria lista (o form do admin tinha uma, o catálogo tinha o mapa de
 * emoji com outros nomes, e o upload do usuário grava "Outros" fixo). Isso
 * produz "Rock", "rock" e "Punk Rock" como três gêneros diferentes, o que
 * quebra qualquer filtro. Aqui ficam a lista, os emojis e o normalizador.
 *
 * Importante: NÃO é um enum no banco. Músicas antigas podem ter gêneros fora
 * desta lista — por isso os filtros das telas são montados a partir dos
 * valores que existem de fato nos dados, nunca desta constante.
 */

export const GENRE_OPTIONS = [
  "Rock",
  "Punk",
  "Metal",
  "Pop",
  "Blues",
  "Jazz",
  "Funk/Soul",
  "Disco",
  "Reggae",
  "Country",
  "Latin",
  "Rap/Hip-Hop",
  "Eletrônica",
  "MPB",
  "Samba",
  "Pagode",
  "Bossa Nova",
  "Sertanejo",
  "Forró",
  "Axé",
  "Gospel",
  "Balada",
  "Instrumental",
  "Infantil",
  "Outros",
] as const;

export type Genre = (typeof GENRE_OPTIONS)[number];

/** Emoji por gênero. Cobre também nomes legados vindos da carga em lote
 *  (ver 3-SUNO/Levantamento-BackingTracks-Suno.xlsx) e do form antigo do
 *  admin. Gênero sem entrada aqui cai no fallback "🎵" de `genreEmoji`. */
export const GENRE_EMOJI: Record<string, string> = {
  Rock: "🎸", Punk: "🧷", Metal: "🤘", Pop: "🎤", Blues: "😢", Jazz: "🎺",
  "Funk/Soul": "🕺", Funk: "🕺", Disco: "🪩", Reggae: "🌿",
  Country: "🤠", Sertanejo: "🤠", Latin: "💃",
  "Rap/Hip-Hop": "🎧", Eletrônica: "🎛️",
  MPB: "🇧🇷", Samba: "🥁", Pagode: "🥁", "Pagode/Samba": "🥁",
  "Bossa Nova": "🎷", Fusion: "🎷", Forró: "🪗", Axé: "🪘",
  Gospel: "✝️", "Gospel/Louvor": "✝️",
  Balada: "💫", Instrumental: "🎹", Infantil: "🧸",
  Regional: "🎶", "World Groove": "🌍", "Lo-fi/Chill": "☕",
  Outros: "🎵", Outro: "🎵",
};

export function genreEmoji(genre: string | null | undefined): string {
  if (!genre) return "🎵";
  return GENRE_EMOJI[genre] ?? GENRE_EMOJI[normalizeGenre(genre)] ?? "🎵";
}

/** Remove acentos e caixa para comparar rótulos escritos de qualquer jeito. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Apelidos → nome canônico. A chave é sempre o resultado de `fold()`. */
const ALIASES: Record<string, string> = {
  "outro": "Outros",
  "outros": "Outros",
  "punk rock": "Punk",
  "hardcore": "Punk",
  "heavy metal": "Metal",
  "funk": "Funk/Soul",
  "soul": "Funk/Soul",
  "hip hop": "Rap/Hip-Hop",
  "hip-hop": "Rap/Hip-Hop",
  "rap": "Rap/Hip-Hop",
  "eletronico": "Eletrônica",
  "electronic": "Eletrônica",
  "edm": "Eletrônica",
  "gospel/louvor": "Gospel",
  "louvor": "Gospel",
  "pagode/samba": "Pagode",
  "bossa": "Bossa Nova",
  "sertanejo universitario": "Sertanejo",
  "romantica": "Balada",
  "romantico": "Balada",
};

/**
 * Devolve o nome canônico de um gênero digitado à mão.
 * Se não reconhecer, devolve o texto original (só aparado) — nunca inventa
 * um gênero nem apaga o que o usuário escreveu.
 */
export function normalizeGenre(raw: string | null | undefined): string {
  if (!raw) return "Outros";
  const trimmed = raw.trim();
  if (!trimmed) return "Outros";
  const key = fold(trimmed);
  const exact = GENRE_OPTIONS.find(g => fold(g) === key);
  if (exact) return exact;
  return ALIASES[key] ?? trimmed;
}
