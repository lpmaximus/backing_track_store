import NextAuth from "next-auth";
import { NextResponse, NextRequest } from "next/server";
import type { Session } from "next-auth";
import { authConfig } from "./auth.config";

// Instância própria, edge-safe — NÃO usar `auth` de "@/auth" aqui,
// pois esse arquivo importa src/db (Neon) no topo do módulo, o que
// quebra no Edge Runtime do middleware ("No database connection
// string was provided to neon()").
const { auth } = NextAuth(authConfig);

export default auth((req: NextRequest & { auth: Session | null }) => {
  const { pathname } = req.nextUrl;

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
