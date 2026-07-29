/**
 * Traduz uma rota interna guardada como string (banco, e-mail, webhook) para a
 * URL do idioma corrente.
 *
 * Motivo: notificações gravam `link` no banco como caminho em português
 * (`/song/minha-musica`, `/setlists/3`). Esses valores são texto livre, então
 * não passam pelo <Link> tipado do next-intl. Sem tradução, um assinante em
 * inglês clicaria na notificação e cairia numa URL em português — que, com
 * prefixo /en, sequer existe.
 *
 * Estratégia: monta um regex a partir do padrão em português de cada rota do
 * mapa (`/song/[slug]` → /^\/song\/([^/]+)$/), casa o caminho recebido,
 * extrai os parâmetros e remonta com getPathname no idioma pedido.
 * Se nada casar, devolve o caminho original — degradação silenciosa é melhor
 * que link quebrado.
 */
import { pathnames, defaultLocale, type Locale } from "./routing";
import { getPathname } from "./navigation";

type PathKey = keyof typeof pathnames;

/** Padrão em português de uma rota do mapa. */
function ptPattern(key: PathKey): string {
  const entry = pathnames[key] as string | Record<Locale, string>;
  return typeof entry === "string" ? entry : entry[defaultLocale];
}

/** Nomes dos segmentos dinâmicos, na ordem em que aparecem. */
function paramNames(pattern: string): string[] {
  return [...pattern.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
}

function toRegExp(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((seg) =>
      seg.startsWith("[") && seg.endsWith("]")
        ? "([^/]+)"
        : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${source}$`);
}

// Rotas mais específicas primeiro: /setlists/[id]/palco tem que ser testada
// antes de /setlists/[id], senão a genérica captura "palco" como id.
const ENTRIES = (Object.keys(pathnames) as PathKey[])
  .map((key) => {
    const pattern = ptPattern(key);
    return { key, pattern, regex: toRegExp(pattern), params: paramNames(pattern) };
  })
  .sort((a, b) => b.pattern.split("/").length - a.pattern.split("/").length);

export function localizePath(stored: string, locale: Locale): string {
  if (!stored.startsWith("/")) return stored;

  const [path, query] = stored.split("?");

  for (const { key, regex, params } of ENTRIES) {
    const match = path.match(regex);
    if (!match) continue;

    const values: Record<string, string> = {};
    params.forEach((name, i) => { values[name] = match[i + 1]; });

    const href = params.length
      ? ({ pathname: key, params: values } as never)
      : (key as never);

    const resolved = getPathname({ href, locale });
    return query ? `${resolved}?${query}` : resolved;
  }

  return stored;
}
