import NextAuth from "next-auth";
import { NextResponse, NextRequest } from "next/server";
import type { Session } from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { authConfig } from "./auth.config";
import { routing } from "./src/i18n/routing";
import { LOCALE_COOKIE, localeFromPathname, resolveLocale } from "./src/i18n/geo";
import { getPathname } from "./src/i18n/navigation";

// Instância própria, edge-safe — NÃO usar `auth` de "@/auth" aqui,
// pois esse arquivo importa src/db (Neon) no topo do módulo, o que
// quebra no Edge Runtime ("No database connection string was provided to neon()").
const { auth } = NextAuth(authConfig);

// Middleware do next-intl: reescreve /en/pricing → app/[locale]/planos e injeta
// o locale no request. A detecção dele fica desligada (localeDetection: false
// em routing.ts) porque quem decide o idioma é a regra de país abaixo.
const intlMiddleware = createIntlMiddleware(routing);

/** Rotas que NÃO passam pelo i18n (seguem só em português). */
function isNonLocalized(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    pathname.includes(".")
  );
}

export default auth((req: NextRequest & { auth: Session | null }) => {
  const { pathname } = req.nextUrl;

  // ── MAINTENANCE MODE ────────────────────────────────────────────────────────
  // Para ligar: MAINTENANCE_MODE=true no .env.local (ou variável de ambiente).
  // Para desligar: mudar para false ou remover a variável.
  const isStaticAsset = /\.(?:png|jpe?g|gif|svg|ico|webp|mp4|woff2?|ttf|css|js|map)$/.test(pathname);
  if (
    process.env.MAINTENANCE_MODE === "true" &&
    !pathname.endsWith("/coming-soon") &&
    !isStaticAsset
  ) {
    return NextResponse.redirect(new URL("/coming-soon", req.url));
  }

  if (isNonLocalized(pathname)) return NextResponse.next();

  // ── IDIOMA POR PAÍS ─────────────────────────────────────────────────────────
  // URL sem prefixo = ainda não sabemos a intenção do visitante. Se a regra
  // aponta inglês (fora do Brasil, ou cookie em inglês), redireciona para
  // /en/... preservando a rota. Com prefixo explícito, a URL manda.
  const explicit = localeFromPathname(pathname);
  if (!explicit) {
    const { locale, source } = resolveLocale(req);
    if (locale !== routing.defaultLocale) {
      const url = new URL(req.url);
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      const res = NextResponse.redirect(url);
      // Grava a escolha para não pagar o redirect em toda navegação e para o
      // seletor de idioma ter um estado inicial coerente.
      if (source !== "cookie") {
        res.cookies.set(LOCALE_COOKIE, locale, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      }
      // O destino depende de IP/cookie: não pode ficar em cache compartilhado.
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("Vary", "Cookie, Accept-Language, X-Vercel-IP-Country");
      return res;
    }
  }

  // ── ROTAS PROTEGIDAS ────────────────────────────────────────────────────────
  // Compara ignorando o prefixo de idioma; o destino do login já sai no idioma
  // corrente (/entrar em pt, /en/sign-in em en).
  const locale = explicit ?? routing.defaultLocale;
  const bare = explicit ? pathname.replace(`/${explicit}`, "") || "/" : pathname;
  const protectedPaths = [
    "/setlist",
    "/perfil",
    "/my-songs",
    "/conta",
    "/account",
    "/upload",
  ];
  const isProtected = protectedPaths.some((p) => bare === p || bare.startsWith(`${p}/`));

  if (isProtected && !req.auth) {
    const loginUrl = new URL(getPathname({ href: "/entrar", locale }), req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  // /admin continua no matcher para o maintenance mode valer lá também.
  matcher: ["/((?!api|_next/static|_next/image|_vercel|favicon.ico|.*\\..*).*)"],
};
