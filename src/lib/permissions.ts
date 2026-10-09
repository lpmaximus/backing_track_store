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

// Os quatro perfis do ADR-BTS-001 + studio (EVT-004) + admin. FreeBand é estado
// derivado (role 'free' + membro ativo de banda), não um valor de users.role.
//
// ORDEM DE PODER: free < freeband < pro < proband < studio < admin.
// 'studio' (BTS-Studio) é supraconjunto estrito de 'proband': tudo que o
// ProBand pode, mais as ações exclusivas do tier. Quem adicionar capability
// nova precisa lembrar disso — proband sem studio no Set é quase sempre um bug.
export type UserType = "free" | "pro" | "proband" | "studio" | "freeband" | "admin";

export type Action =
  | "comment_publication" // comentar na página da música (comunidade)
  | "comment_band_setlist" // comentar no repertório da própria banda
  | "create_setlist" // criar setlist pessoal
  | "create_band" // criar/possuir banda
  | "view_shared_catalog" // ver uploads compartilhados entre Pros
  // ─── Exclusivas do BTS-Studio (EVT-004) ────────────────────────────────
  | "guitar_tab" // ver a tablatura gerada automaticamente (BETA — ver nota)
  | "record_take" // gravar take próprio por cima dos stems (overdub)
  | "copy_song" // pegar música do catálogo para a sua área (/estudio)
  // ─── Todo plano pago (EVT-005) ─────────────────────────────────────────
  | "loop_pedal"; // pedal de loop ao vivo — efêmero, não gera arquivo

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
  if (role === "studio") return "studio";
  if (role === "proband") return "proband";
  if (role === "pro") return "pro";
  return isActiveBandMember ? "freeband" : "free";
}

// Matriz de capacidades — espelha ESTRUTURA-USUARIOS-PLANO.md §2.
// admin é supraconjunto de studio, que é supraconjunto de proband.
const CAPABILITIES: Record<Action, ReadonlySet<UserType>> = {
  comment_publication: new Set(["pro", "proband", "studio", "admin"]),
  comment_band_setlist: new Set(["freeband", "pro", "proband", "studio", "admin"]),
  create_setlist: new Set(["pro", "proband", "studio", "admin"]),
  create_band: new Set(["proband", "studio", "admin"]),
  view_shared_catalog: new Set(["pro", "proband", "studio", "admin"]),

  // Exclusivas do BTS-Studio. NÃO incluir proband aqui — é justamente o que o
  // tier novo vende. Se um dia a tab virar padrão do Band, esta linha é o
  // único lugar a mudar.
  guitar_tab: new Set(["studio", "admin"]),
  record_take: new Set(["studio", "admin"]),
  copy_song: new Set(["studio", "admin"]),

  // O pedal de loop usa o microfone, como `record_take` — e mesmo assim NÃO é
  // exclusivo do Studio. A diferença que justifica isso não é de grau, é de
  // natureza: o loop vive na memória da aba e some quando a janela fecha. Não
  // vira arquivo, não sobe para o R2 e não deixa gravação de voz de ninguém
  // parada num servidor, que é justamente o que a decisão de 14/08/2026 quis
  // reservar ao tier. O que sobra é uma ferramenta de ensaio, da mesma família
  // do loop A–B que o Pro já tem. Ver EVT-005 §7.
  //
  // Se um dia surgir "salvar o loop", ele NÃO herda esta linha: salvar produz
  // arquivo e cai na régua do `record_take`.
  loop_pedal: new Set(["pro", "proband", "studio", "admin"]),
};

/**
 * A tablatura automática entra no v1 rotulada como BETA (decisão de 14/08/2026).
 *
 * O motivo está medido, não é cautela genérica: o dedilhado bate 71,9% em
 * violão/clean mas cai para ~37% em rock elétrico, e nunca foi medido no stem
 * separado que a produção realmente entrega (só em áudio de estúdio isolado e
 * em áudio sintético). Ver EVT-003-DEFINITION-OF-DONE.md.
 *
 * Consequência prática para quem constrói UI: toda tela que consome
 * `guitar_tab` PRECISA mostrar o aviso de beta e o caminho de correção manual.
 * Quando os três portões do EVT-003 passarem, apagar esta constante e o rótulo
 * — é o sinal de que a feature saiu do beta.
 */
export const GUITAR_TAB_IS_BETA = true;

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
