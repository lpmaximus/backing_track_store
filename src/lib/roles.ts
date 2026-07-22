/**
 * Helper de role PURO — sem imports de banco de dados.
 *
 * Pode ser importado tanto no client (componentes "use client") quanto no
 * middleware/edge, porque não toca o Neon. A checagem que consulta o banco
 * (acesso via banda) fica em src/lib/access.ts, que NÃO pode ir para o client
 * nem para o middleware (regra do edge — ver auth.config.ts).
 */
export function isProRole(role?: string | null): boolean {
  // proband (líder de banda, plano pago) tem o mesmo acesso Pro individual.
  return role === "pro" || role === "proband" || role === "admin";
}

/**
 * Decisão PURA de acesso Pro — sem banco, fácil de testar.
 * `hasActiveBandAccess` resume a consulta de membership+assinatura feita
 * em src/lib/access.ts (`hasProAccess`). Mantida aqui, junto de `isProRole`,
 * para que os testes de segurança não precisem tocar o Neon.
 */
export function decideProAccess(input: {
  role?: string | null;
  hasActiveBandAccess: boolean;
}): boolean {
  return isProRole(input.role) || input.hasActiveBandAccess;
}

/**
 * Rótulo curto da categoria do usuário, para exibição na UI (badge do header,
 * perfil, etc.). PURO — pode ser usado no client. `isActiveBandMember` só muda
 * o resultado quando role='free' (Free vs. Free Banda); para os demais roles é
 * ignorado. Espelha resolveUserType() de src/lib/permissions.ts.
 */
export function roleLabel(
  role?: string | null,
  isActiveBandMember = false,
): string {
  switch (role) {
    case "admin":   return "ADMIN";
    case "proband": return "PRO BAND";
    case "pro":     return "PRO";
    default:        return isActiveBandMember ? "BANDA" : "FREE";
  }
}
