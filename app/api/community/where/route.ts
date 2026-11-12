/**
 * GET /api/community/where — país do visitante (só o código ISO, nada mais).
 *
 * A home é renderizada no servidor e cacheada em parte; o país de quem está
 * vendo é resolvido aqui, no cliente, para o "Seja o primeiro de <país>" e
 * para pré-selecionar o país no formulário do mural.
 */
import { NextRequest, NextResponse } from "next/server";
import { countryFromHeaders } from "@/src/lib/community";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return NextResponse.json(
    { country: countryFromHeaders(req.headers) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
