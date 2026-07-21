/**
 * Camada central de autorização (ADR-BTS-001 / ADR-BTS-002).
 *
 * Fonte única de verdade para "o que cada tipo de usuário pode fazer".
 * Substitui as checagens de role soltas rota a rota. Espelha a matriz de
 * permissões de docs/ESTRUTURA-USUARIOS-PLANO.md §2.
 *
 * Módulo PURO — não toca o banco (Neon). Pode ser importado no client, no
 * middleware/edge e nas rotas. A resolução de "é membro ativo de banda?"
 * (que precisa do banco) fica fora daqui: quem chama passa o booleano já
 * resolvido. Para os capabilities em que Free e FreeBand têm o mesmo veredito
 * (comment_publication, create_setlist, view_shared_catalog), o chamador pode
 * omitir o vínculo de banda — o resultado é o mesmo.
 */

// Os quatro perfis do ADR-BTS-001 + admin. FreeBand é estado derivado
// (role 'free' + membro ativo de banda), não um valor de users.role.
export type UserType = "free" | "pro" | "proband" | "freeband" | "admin";

export type Action =
  | "comment_publication" // comentar na página da música (comunidade)
  | "comment_band_setlist" // comentar no repertório da própria banda
  | "create_setlist" // criar setlist pessoal
  | "create_band" // criar/possuir banda
  | "view_shared_catalog"; // ver uploads compartilhados entre Pros

/**
 * Resolve o tipo efetivo do usuário a partir do role (users.role) + vínculo
 * de banda ativo. `isActiveBandMember` só muda o resultado quando role='free'
 * (free vs. freeband); para os demais roles é ignorado.
 */
export function resolveUserType(
  role?: string | null,
  isActiveBandMember = false,
): UserType {
  if (role === "admin") return "admin";
  if (role === "proband") return "proband";
  if (role === "pro") return "pro";
  return isActiveBandMember ? "freeband" : "free";
}

// Matriz de capacidades — espelha ESTRUTURA-USUARIOS-PLANO.md §2.
// admin é supraconjunto de proband (acesso total).
const CAPABILITIES: Record<Action, ReadonlySet<UserType>> = {
  comment_publication: new Set(["pro", "proband", "admin"]),
  comment_band_setlist: new Set(["freeband", "pro", "proband", "admin"]),
  create_setlist: new Set(["pro", "proband", "admin"]),
  create_band: new Set(["proband", "admin"]),
  view_shared_catalog: new Set(["pro", "proband", "admin"]),
};

/** Verdadeiro se o tipo de usuário pode executar a ação. */
export function can(userType: UserType, action: Action): boolean {
  return CAPABILITIES[action].has(userType);
}

/** Atalho: resolve o tipo e consulta a capacidade num passo só. */
export function roleCan(
  role: string | null | undefined,
  action: Action,
  isActiveBandMember = false,
): boolean {
  return can(resolveUserType(role, isActiveBandMember), action);
}
