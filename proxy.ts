import NextAuth from "next-auth";
import { NextResponse, NextRequest } from "next/server";
import type { Session } from "next-auth";
import { authConfig } from "./auth.config";

// Instância própria, edge-safe — NÃO usar `auth` de "@/auth" aqui,
// pois esse arquivo importa src/db (Neon) no topo do módulo, o que
// quebra no Edge Runtime ("No database connection string was provided to neon()").
const { auth } = NextAuth(authConfig);

export default auth((req: NextRequest & { auth: Session | null }) => {
  const { pathname } = req.nextUrl;

  // ── MAINTENANCE MODE ────────────────────────────────────────────────────────
  // Para ligar: MAINTENANCE_MODE=true no .env.local (ou variável de ambiente).
  // Para desligar: mudar para false ou remover a variável.
  const isStaticAsset = /\.(?:png|jpe?g|gif|svg|ico|webp|woff2?|ttf|css|js|map)$/.test(pathname);
  if (process.env.MAINTENANCE_MODE === "true" && pathname !== "/coming-soon" && !isStaticAsset) {
    return NextResponse.redirect(new URL("/coming-soon", req.url));
  }

  // Rotas protegidas que exigem login
  const protectedPaths = ["/setlist", "/perfil"];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/entrar", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
