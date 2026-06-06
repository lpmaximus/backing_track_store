import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";
import type { Session } from "next-auth";

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
