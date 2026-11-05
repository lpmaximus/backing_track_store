/**
 * Títulos do catálogo próprio em inglês e espanhol.
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

/** Mesmos títulos em espanhol (chave = título em português, como no mapa acima). */
export const CATALOG_TITLES_ES: Record<string, string> = {
  "Arena rock anos 80": "Arena rock de los 80",
  "Arrocha": "Arrocha (romántico brasileño)",
  "Bachata": "Bachata",
  "Baião": "Baião (nordeste brasileño)",
  "Balada acústica em tom menor": "Balada acústica en tono menor",
  "Black gospel": "Black gospel",
  "Blues rock": "Blues rock",
  "Bossa nova": "Bossa nova",
  "Bossa nova jazz": "Bossa nova jazz",
  "Brega Paraense": "Brega paraense (pop amazónico)",
  "Classic rock": "Rock clásico",
  "Classic rock lento": "Rock clásico lento",
  "Congregacional pop": "Pop congregacional (alabanza)",
  "Forró pé de serra": "Forró pé de serra (folk brasileño)",
  "Funk clássico (anos 60/70)": "Funk clásico (años 60/70)",
  "Funky blues": "Funky blues",
  "Grunge anos 90": "Grunge de los 90",
  "Hard rock": "Hard rock",
  "Hard rock anos 70 (riff pesado)": "Hard rock de los 70 (riff pesado)",
  "Heavy metal": "Heavy metal",
  "Indie/alt rock": "Indie/rock alternativo",
  "Jazz blues": "Jazz blues",
  "Jazz modal": "Jazz modal",
  "Louvor alto/celebração": "Alabanza alegre/celebración",
  "MPB pop": "MPB pop (pop brasileño)",
  "Motown/Soul": "Motown/Soul",
  "Neo soul": "Neo soul",
  "Pagode romântico": "Pagode romántico (samba)",
  "Pop acústico": "Pop acústico",
  "Pop dance": "Pop dance",
  "Pop moderno": "Pop moderno",
  "Pop punk anos 2000": "Pop punk de los 2000",
  "Pop rock ballad": "Balada pop rock",
  "Pop rock nacional anos 90": "Pop rock brasileño de los 90",
  "Power ballad rock": "Power ballad de rock",
  "Punk rock": "Punk rock",
  "R&B moderno": "R&B moderno",
  "Rock acústico / unplugged": "Rock acústico / unplugged",
  "Rock alternativo anos 2000": "Rock alternativo de los 2000",
  "Rock and roll anos 50": "Rock and roll de los 50",
  "Rock em tom menor": "Rock en tono menor",
  "Rock en español / rock latino": "Rock en español / rock latino",
  "Rock instrumental (guitarra solo)": "Rock instrumental (solo de guitarra)",
  "Samba de raiz": "Samba de raíz",
  "Samba-jazz": "Samba-jazz",
  "Sertanejo raiz/moda de viola": "Sertanejo de raíz (country brasileño)",
  "Sertanejo sofrência": "Sertanejo sofrência (balada country brasileña)",
  "Sertanejo universitário": "Sertanejo universitário (country pop brasileño)",
  "Shuffle blues (Texas)": "Shuffle blues (Texas)",
  "Slow blues 12/8": "Slow blues 12/8",
  "Slow rock 12/8": "Slow rock 12/8",
  "Southern rock": "Southern rock",
  "Swing/Bebop": "Swing/Bebop",
  "Worship contemporâneo": "Alabanza contemporánea",
  "Xote": "Xote (folk brasileño)",
};

const TITLE_MAPS: Partial<Record<string, Record<string, string>>> = {
  en: CATALOG_TITLES_EN,
  es: CATALOG_TITLES_ES,
};

/** Título para exibir no idioma da página. */
export function localizeSongTitle(title: string, locale: Locale | string): string {
  return TITLE_MAPS[locale]?.[title] ?? title;
}

/**
 * Busca no idioma da página: devolve os títulos ORIGINAIS (pt) cuja tradução
 * contém o termo — o caller soma isso ao ILIKE do banco, senão "ballad" nunca
 * acharia "Balada acústica em tom menor". Em pt devolve lista vazia.
 */
export function ptTitlesMatching(q: string, locale: Locale | string): string[] {
  const map = TITLE_MAPS[locale];
  const needle = q.trim().toLowerCase();
  if (!map || !needle) return [];
  return Object.entries(map)
    .filter(([, translated]) => translated.toLowerCase().includes(needle))
    .map(([pt]) => pt);
}

/** @deprecated use ptTitlesMatching(q, "en") */
export function ptTitlesMatchingEn(q: string): string[] {
  return ptTitlesMatching(q, "en");
}
