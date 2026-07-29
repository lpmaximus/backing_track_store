/**
 * Configuração de rotas i18n (ADR-BTS-006).
 *
 * pt  → idioma padrão, SEM prefixo (mantém todas as URLs atuais intactas:
 *       backingtrack.store/planos continua funcionando e mantém o SEO).
 * en  → prefixo /en com slugs traduzidos (backingtrack.store/en/pricing).
 *
 * `localeDetection: false` porque a negociação NÃO é por Accept-Language e sim
 * por país (ver proxy.ts): fora do Brasil o visitante cai em inglês. O cookie
 * NEXT_LOCALE continua sendo respeitado — escolha manual sempre vence.
 */
import { defineRouting } from "next-intl/routing";

export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

/** Tag BCP-47 usada em <html lang>, hreflang e Intl.* */
export const htmlLang: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
};

/**
 * Slugs por idioma. A chave é sempre o caminho interno (= pasta em app/[locale]).
 * Só precisa entrar aqui a rota cujo slug muda de idioma; as demais herdam.
 */
export const pathnames = {
  "/": "/",

  // Público / marketing
  "/catalogo": { pt: "/catalogo", en: "/catalog" },
  "/planos": { pt: "/planos", en: "/pricing" },
  "/como-funciona": { pt: "/como-funciona", en: "/how-it-works" },
  "/sobre": { pt: "/sobre", en: "/about" },
  "/contato": { pt: "/contato", en: "/contact" },
  "/entrar": { pt: "/entrar", en: "/sign-in" },
  "/coming-soon": "/coming-soon",

  // App logado
  "/upload": { pt: "/upload", en: "/upload" },
  "/perfil": { pt: "/perfil", en: "/my-songs" },
  "/compartilhadas": { pt: "/compartilhadas", en: "/shared" },
  "/conta": { pt: "/conta", en: "/account" },
  "/song/[slug]": { pt: "/song/[slug]", en: "/song/[slug]" },

  "/setlists": "/setlists",
  "/setlists/[id]": "/setlists/[id]",
  "/setlists/[id]/palco": { pt: "/setlists/[id]/palco", en: "/setlists/[id]/stage" },
  "/setlists/[id]/ensaios/[eventId]": {
    pt: "/setlists/[id]/ensaios/[eventId]",
    en: "/setlists/[id]/rehearsals/[eventId]",
  },

  "/bandas": { pt: "/bandas", en: "/bands" },
  "/bandas/entrar/[token]": { pt: "/bandas/entrar/[token]", en: "/bands/join/[token]" },
  "/convite/[token]": { pt: "/convite/[token]", en: "/invite/[token]" },
  "/convite/[token]/sair": { pt: "/convite/[token]/sair", en: "/invite/[token]/leave" },

  // Legal
  "/termos": { pt: "/termos", en: "/terms" },
  "/privacidade": { pt: "/privacidade", en: "/privacy" },
  "/cookies": { pt: "/cookies", en: "/cookies" },
} as const;

/** Toda rota do mapa, inclusive as dinâmicas (`/song/[slug]`). */
export type Pathname = keyof typeof pathnames;

/**
 * Só as rotas SEM segmento dinâmico.
 *
 * É o tipo certo para menus, rodapé e carrossel: uma rota como `/song/[slug]`
 * não pode ser passada como string ao <Link>, ela exige a forma
 * `{ pathname, params }`. Restringir aqui faz o erro aparecer na lista de
 * itens do menu, e não lá na frente no JSX.
 */
export type StaticPathname = Exclude<Pathname, `${string}[${string}`>;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames,
});
