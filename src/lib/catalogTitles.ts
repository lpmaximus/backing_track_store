/**
 * Títulos do catálogo próprio em inglês.
 *
 * As 55 bases do catálogo nasceram com título em português (carga do Suno,
 * 3-SUNO/Levantamento-BackingTracks-Suno.xlsx), mas ~75% de quem abre o
 * catálogo vem de fora do Brasil (GA, set–out/2026). Em vez de uma coluna nova
 * no banco, o mapa vive aqui: o título salvo continua sendo o em português (é o
 * que o admin edita e o que gera o slug) e só a EXIBIÇÃO muda no /en.
 *
 * Chave = título exato como está em `songs.title`. Título fora do mapa (upload
 * de usuário, música nova) aparece como está — nunca quebra.
 */
import type { Locale } from "@/src/i18n/routing";

export const CATALOG_TITLES_EN: Record<string, string> = {
  "Arena rock anos 80": "80s arena rock",
  "Arrocha": "Arrocha (Brazilian romantic)",
  "Bachata": "Bachata",
  "Baião": "Baião (Brazilian northeast)",
  "Balada acústica em tom menor": "Acoustic ballad in a minor key",
  "Black gospel": "Black gospel",
  "Blues rock": "Blues rock",
  "Bossa nova": "Bossa nova",
  "Bossa nova jazz": "Bossa nova jazz",
  "Brega Paraense": "Brega paraense (Amazon pop)",
  "Classic rock": "Classic rock",
  "Classic rock lento": "Slow classic rock",
  "Congregacional pop": "Congregational pop worship",
  "Forró pé de serra": "Forró pé de serra (Brazilian folk)",
  "Funk clássico (anos 60/70)": "Classic funk (60s/70s)",
  "Funky blues": "Funky blues",
  "Grunge anos 90": "90s grunge",
  "Hard rock": "Hard rock",
  "Hard rock anos 70 (riff pesado)": "70s hard rock (heavy riff)",
  "Heavy metal": "Heavy metal",
  "Indie/alt rock": "Indie/alt rock",
  "Jazz blues": "Jazz blues",
  "Jazz modal": "Modal jazz",
  "Louvor alto/celebração": "Upbeat worship/celebration",
  "MPB pop": "MPB pop (Brazilian pop)",
  "Motown/Soul": "Motown/Soul",
  "Neo soul": "Neo soul",
  "Pagode romântico": "Romantic pagode (samba)",
  "Pop acústico": "Acoustic pop",
  "Pop dance": "Dance pop",
  "Pop moderno": "Modern pop",
  "Pop punk anos 2000": "2000s pop punk",
  "Pop rock ballad": "Pop rock ballad",
  "Pop rock nacional anos 90": "90s Brazilian pop rock",
  "Power ballad rock": "Rock power ballad",
  "Punk rock": "Punk rock",
  "R&B moderno": "Modern R&B",
  "Rock acústico / unplugged": "Acoustic rock / unplugged",
  "Rock alternativo anos 2000": "2000s alternative rock",
  "Rock and roll anos 50": "50s rock and roll",
  "Rock em tom menor": "Rock in a minor key",
  "Rock en español / rock latino": "Rock en español / Latin rock",
  "Rock instrumental (guitarra solo)": "Instrumental rock (guitar solo)",
  "Samba de raiz": "Roots samba",
  "Samba-jazz": "Samba-jazz",
  "Sertanejo raiz/moda de viola": "Roots sertanejo (Brazilian country)",
  "Sertanejo sofrência": "Sertanejo sofrência (Brazilian country ballad)",
  "Sertanejo universitário": "Sertanejo universitário (Brazilian country pop)",
  "Shuffle blues (Texas)": "Texas shuffle blues",
  "Slow blues 12/8": "Slow blues 12/8",
  "Slow rock 12/8": "Slow rock 12/8",
  "Southern rock": "Southern rock",
  "Swing/Bebop": "Swing/Bebop",
  "Worship contemporâneo": "Contemporary worship",
  "Xote": "Xote (Brazilian folk)",
};

/** Título para exibir no idioma da página. */
export function localizeSongTitle(title: string, locale: Locale | string): string {
  if (locale !== "en") return title;
  return CATALOG_TITLES_EN[title] ?? title;
}

/**
 * Busca em inglês: devolve os títulos ORIGINAIS (pt) cuja tradução contém o
 * termo — o caller soma isso ao ILIKE do banco, senão "ballad" nunca acharia
 * "Balada acústica em tom menor".
 */
export function ptTitlesMatchingEn(q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return Object.entries(CATALOG_TITLES_EN)
    .filter(([, en]) => en.toLowerCase().includes(needle))
    .map(([pt]) => pt);
}
