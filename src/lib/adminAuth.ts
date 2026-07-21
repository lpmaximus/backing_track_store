/**
 * Auth do painel administrativo (R3 / ADR-BTS-003).
 *
 * Decisão do usuário (2026-07-18): os módulos novos do admin usam o mesmo
 * segredo compartilhado do /admin de músicas (header x-admin-password contra
 * ADMIN_PASSWORD), não a sessão. Centralizado aqui para não repetir a checagem
 * em cada rota. Ver /api/admin/upload-url para o padrão original.
 */
import { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  const pass = req.headers.get("x-admin-password");
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && pass === expected;
}
