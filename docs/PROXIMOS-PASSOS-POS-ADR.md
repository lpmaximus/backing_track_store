# Próximos Passos — pós ADR-BTS-001/002/003

> Consolidação registrada em 2026-07-18, depois de fechados os três ADRs.
> Cruza cada decisão dos ADRs com o **estado real do código** (lido no repositório
> em 2026-07-18) e ordena a implementação. Substitui a leitura solta das seções
> "Pontos em aberto" espalhadas pelos três ADRs.

---

## 1. O que já está pronto (não retrabalhar)

Base da Fase 1.5 + frentes C/D/E entregues e no repositório:

- **Upload → separação** de stems via Replicate/Demucs 6-stem (`htdemucs_6s`), com webhook idempotente e assinado, retenção do mix original só durante o pipeline.
- **Cache por hash** (`songs.sourceHash`, `user_songs` via `upload`/`cache`).
- **`hasProAccess`** (`src/lib/access.ts` + `src/lib/roles.ts`): acesso Pro individual **e** herdado por membro ativo de banda com assinatura ativa. Coberto por `roles.test.ts`.
- **Cifra automática** (Music.ai) + selo de origem/estado.
- **Correção colaborativa + moderação** de cifra: `/admin/moderacao` (denúncias, reverter edição). `cifra_edit_history`, `cifra_reports` no schema.
- **Banda + setlist compartilhado**: `bands`, `band_members` (convite por **link/token**), `setlists.bandId`.

---

## 2. Gap analysis — decisão do ADR × código

### ADR-BTS-001 (RBAC Plano×Papel×Permissão + limites)

| Decisão do ADR | Estado no código | Ação |
|---|---|---|
| Três camadas Plano/Papel/Permissão com `can(userType, action)` central | **Ausente.** Não existe `src/lib/permissions.ts`; checagens de role soltas rota a rota | Implementar |
| Plano `proband` em `users.role` | **Ausente.** Código só conhece `free/pro/admin` (`roles.ts`, `quota.ts`) | Implementar |
| Limites de separação **3 / 20 / 40** | **Divergente.** `quota.ts` usa `FREE=5` / `PRO=500`, sem `proband` | Corrigir |
| Janela da cota = ciclo de assinatura (fallback aniversário p/ free) | **Divergente.** Conta por mês-calendário (`startOfMonth`) | Corrigir |
| Free com export completo das 3 faixas | Cota é 5 (não 3); export já é completo | Ajustar número |
| Caps **públicos** + usuário vê "14/20 usadas" (transparência, 18/07) | **Ausente.** Nenhuma UI de uso vs. limite | Implementar |
| Limite de armazenamento por GB/tier | Aberto no ADR — fora do MVP | Não fazer agora |

### ADR-BTS-002 (matriz de funcionalidades)

| Decisão / recomendação | Estado no código | Ação |
|---|---|---|
| **Permissão por trilha/música** (integrante só vê o instrumento autorizado + auto-mute no player) — MVP do diferencial | **Ausente.** `band_members.instrument` existe, mas não há tabela de autorização música↔banda nem auto-mute no player | Implementar (prioridade alta) |
| Comentário de setlist de banda (todo membro escreve) | **Ausente.** Tabela `setlist_comments` não existe | Implementar |
| Limite de 5 integrantes por banda | **Não imposto.** `band_members` sem enforcement | Implementar |
| ProBand sem teto de bandas criadas (recomendação) | `proband` nem existe ainda | Decidir + implementar junto do papel |
| Papel **Guest** (substituto, expiração automática) | **Ausente** | Decidir (em aberto) |
| Convite por **QR code** (MVP p/ ministério) | Só **link/token** hoje | Implementar (QR sobre o token que já existe) |
| Download PDF de cifra p/ todos planos pagos | Verificar rota de cifra | Confirmar + liberar |

### ADR-BTS-003 (MVP do painel administrativo)

| Módulo do MVP | Estado no código | Ação |
|---|---|---|
| **Cifras** (moderação: pendente/aprovado/bloqueado, reverter) | **Pronto** em `/admin/moderacao` | Só falta filtro de status na listagem |
| **Usuários** (listar, ver plano/uso, papel, cobrar/reenviar) | **Ausente** | Implementar |
| **Áudio** (catálogo compartilhado, status pendente/aprovado/bloqueado) | **Ausente** | Implementar |
| **Consumo** (6 números/mês: custo × receita, custo separação ~R$0,40) | **Ausente** | Implementar |
| Custo de separação usado nos cálculos = **~R$0,40/música** (6-stem) | Confirmar contra billing real do Replicate | Validar |

---

## 3. Ordem de execução recomendada

**Fase R1 — Fundação de autorização (base de tudo; ADR-001).**
Sem isso, todo o resto (matriz, admin, transparência) fica sobre role solto.
1. Adicionar `proband` a `users.role` (schema + `src/types/next-auth.d.ts` + comentário do enum).
2. Criar `src/lib/permissions.ts`: `resolveUserType(user, bandMembership?)` e `can(userType, action)` espelhando a matriz da §2 do ESTRUTURA-USUARIOS-PLANO. Migrar `access.ts`/checagens de rota para consumir.
3. Reescrever `src/lib/quota.ts`: limites **3/20/40**, janela por ciclo de assinatura (fallback aniversário da conta p/ free/freeband), reconhecer `proband` e `freeband`.
4. Enforcement nas rotas existentes: `comments` (incluir `proband` na escrita), `setlists` (bloquear free/freeband), `songs/shared` (só pro/proband/admin).

**Fase R2 — Diferencial de banda (ADR-002).** É o que separa o produto de um grupo de WhatsApp.
5. **Permissão por trilha/música**: autorização do líder de qual música/instrumento cada membro vê; player pré-muta tudo menos o instrumento do membro ao abrir música de setlist de banda (a base — `band_members.instrument` com as mesmas chaves dos stems — já existe).
6. Tabela `setlist_comments` + rotas (membro ativo escreve).
7. Enforcement do teto de 5 integrantes na aceitação do convite.
8. **QR code** do convite (gera QR sobre o `inviteToken` que já existe) — sem novo schema.

**Fase R3 — Painel admin MVP (ADR-003).** Operar sozinho.
9. Módulo **Usuários** (lista, plano, uso vs. limite, papel).
10. Módulo **Áudio** (catálogo compartilhado + filtro de status).
11. Módulo **Consumo** (6 números/mês, custo R$0,40 confirmado no Replicate).
12. Filtro de status na listagem de **Cifras** (fecha o módulo já existente).

**Transversal — Transparência (decisão de 18/07, atravessa R1 e R3).**
13. UI de uso vs. limite na conta do usuário ("14/20 separações usadas este mês") e caps públicos na página de preços. Depende da cota nova (R1.3).

---

## 4. Decisões em aberto — travar antes de codar a fase correspondente

Herdadas das seções "Pontos em aberto" dos três ADRs. Recomendação entre parênteses.

Bloqueiam **R1**:
- Âncora da janela de cota do Free/FreeBand: aniversário da conta **vs.** dia 1º (recomendo aniversário da conta — evita reset em massa e é justo com quem entra no fim do mês).

Bloqueiam **R2**:
- Adotar papel **Guest** com expiração automática? (recomendo sim, mas em iteração após a permissão por trilha).
- ProBand tem teto de bandas criadas? (recomendo **não capar** no lançamento — custo marginal ~zero).
- Liberar download de PDF de cifra para todos os planos pagos? (recomendo sim).
- QR code como MVP do convite ou manter link + QR em paralelo? (recomendo QR + link juntos).

Bloqueiam **R3**:
- "Cobrar" no admin: cobrança manual avulsa **ou** só reenvio de link Asaas? (recomendo só reenvio no MVP).
- Hard delete LGPD: fluxo formal com retenção **ou** soft delete + exclusão manual sob pedido? (recomendo soft delete no MVP).
- Consumo: mensal fechado D+1 **ou** acumulado do mês em tempo real? (recomendo D+1).
- Fila de aprovação de correção de cifra já entra no MVP? (já coberta por filtro de status — sim).

Fora de escopo (confirmado nos ADRs): limite de armazenamento por GB, RBAC de equipe interna, impersonate, 2FA, SEO, API pública, backup/monitoramento.

---

## 5. Resumo de uma linha

Base técnica (upload→stems→cifra→banda) está pronta. O que falta é **formalizar a autorização** (proband + `can()` + cota 3/20/40 por ciclo), **entregar o diferencial de banda** (permissão por trilha + auto-mute, comentário de setlist, QR) e **construir o painel admin de 4 módulos**. Ordem: R1 (fundação) → R2 (diferencial) → R3 (admin), com a UI de transparência atravessando R1/R3.
