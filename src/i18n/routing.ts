/**
 * Configuração de rotas i18n (ADR-BTS-006).
 *
 * pt  → idioma padrão, SEM prefixo (mantém todas as URLs atuais intactas:
 *       backingtrack.store/planos continua funcionando e mantém o SEO).
 * en  → prefixo /en com slugs traduzidos (backingtrack.store/en/pricing).
 * es  → prefixo /es com slugs traduzidos (backingtrack.store/es/precios).
 *       Espanhol NUNCA é escolhido automaticamente: fora do Brasil o padrão é
 *       inglês (regra de produto). Só entra por escolha manual no seletor.
 *
 * `localeDetection: false` porque a negociação NÃO é por Accept-Language e sim
 * por país (ver proxy.ts): fora do Brasil o visitante cai em inglês. O cookie
 * NEXT_LOCALE continua sendo respeitado — escolha manual sempre vence.
 */
import { defineRouting } from "next-intl/routing";

export const locales = ["pt", "en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

/** Tag BCP-47 usada em <html lang>, hreflang e Intl.* */
export const htmlLang: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
};

/**
 * Nome de cada idioma escrito NELE MESMO — é assim que o seletor mostra, para
 * quem caiu no idioma errado reconhecer o seu (padrão de mercado).
 */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

/**
 * Slugs por idioma. A chave é sempre o caminho interno (= pasta em app/[locale]).
 * Só precisa entrar aqui a rota cujo slug muda de idioma; as demais herdam.
 */
export const pathnames = {
  "/": "/",

  // Público / marketing
  "/catalogo": { pt: "/catalogo", en: "/catalog", es: "/catalogo" },
  "/planos": { pt: "/planos", en: "/pricing", es: "/precios" },
  "/como-funciona": { pt: "/como-funciona", en: "/how-it-works", es: "/como-funciona" },
  "/sobre": { pt: "/sobre", en: "/about", es: "/sobre-nosotros" },
  "/contato": { pt: "/contato", en: "/contact", es: "/contacto" },
  "/entrar": { pt: "/entrar", en: "/sign-in", es: "/iniciar-sesion" },
  "/coming-soon": "/coming-soon",

  // App logado
  "/upload": { pt: "/upload", en: "/upload", es: "/upload" },
  "/perfil": { pt: "/perfil", en: "/my-songs", es: "/mis-canciones" },
  "/estudio": { pt: "/estudio", en: "/studio", es: "/estudio" },
  "/compartilhadas": { pt: "/compartilhadas", en: "/shared", es: "/compartidas" },
  "/conta": { pt: "/conta", en: "/account", es: "/cuenta" },
  "/song/[slug]": { pt: "/song/[slug]", en: "/song/[slug]", es: "/song/[slug]" },

  "/setlists": "/setlists",
  "/setlists/[id]": "/setlists/[id]",
  "/setlists/[id]/palco": { pt: "/setlists/[id]/palco", en: "/setlists/[id]/stage", es: "/setlists/[id]/escenario" },
  "/setlists/[id]/ensaios/[eventId]": {
    pt: "/setlists/[id]/ensaios/[eventId]",
    en: "/setlists/[id]/rehearsals/[eventId]",
    es: "/setlists/[id]/ensayos/[eventId]",
  },

  "/bandas": { pt: "/bandas", en: "/bands", es: "/bandas" },
  "/bandas/entrar/[token]": { pt: "/bandas/entrar/[token]", en: "/bands/join/[token]", es: "/bandas/unirse/[token]" },
  "/convite/[token]": { pt: "/convite/[token]", en: "/invite/[token]", es: "/invitacion/[token]" },
  "/convite/[token]/sair": { pt: "/convite/[token]/sair", en: "/invite/[token]/leave", es: "/invitacion/[token]/salir" },

  // App nativo (Capacitor) — área mobile carregada pelo WebView do app.
  // Mesmo slug nos dois idiomas: não é página de SEO (noindex no layout) e o
  // app/AndroidManifest/Universal Links apontam para estes caminhos fixos.
  "/app": "/app",
  "/app/boas-vindas": "/app/boas-vindas",
  "/app/entrar": "/app/entrar",
  "/app/handoff": "/app/handoff",
  "/app/estudio": "/app/estudio",
  "/app/song/[slug]": "/app/song/[slug]",
  "/app/setlists": "/app/setlists",
  "/app/setlists/[id]": "/app/setlists/[id]",
  "/app/bandas": "/app/bandas",
  "/app/conta": "/app/conta",
  "/app/mensagens": "/app/mensagens",

  // Legal
  "/termos": { pt: "/termos", en: "/terms", es: "/terminos" },
  "/privacidade": { pt: "/privacidade", en: "/privacy", es: "/privacidad" },
  "/cookies": { pt: "/cookies", en: "/cookies", es: "/cookies" },
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
