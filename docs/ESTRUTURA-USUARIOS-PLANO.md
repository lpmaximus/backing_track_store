# Estrutura de Usuários — Plano de Implementação

> Documento de **plano de passos**, sem implementação. Registrado 2026-07-17.
> Decisões fechadas nesta rodada: FreeBand é **derivado da banda** (a conta segue `free`, a
> capacidade vem de ser membro ativo); cota mensal reseta pelo **ciclo de assinatura**.

---

## 1. Os quatro papéis

Só existem **três valores de conta** em `users.role`: `free`, `pro`, `proband` (+ `admin` interno).
O quarto tipo, **FreeBand**, não é um role gravado — é o estado de uma conta `free` que é
**membro ativo** de uma banda (`band_members.status = 'active'`). Isso evita duplicar estado e
mantém a regra "integrante é um free com poderes extras dentro da banda".

| Tipo | Como se identifica |
|------|--------------------|
| Free | `role = 'free'` e **não** é membro ativo de banda |
| Pro | `role = 'pro'` |
| ProBand (BandLeader) | `role = 'proband'` |
| FreeBand (Integrante) | `role = 'free'` **e** membro ativo de uma banda (`band_members`) |

`admin` mantém acesso total (supraconjunto de ProBand).

---

## 2. Matriz de permissões

| Capacidade | Free | Pro | ProBand | FreeBand |
|------------|:----:|:---:|:-------:|:--------:|
| Separações de áudio / mês | **3** | **20** | **40** | **3** |
| Composições/uploads próprios | limitado à cota | ilimitado¹ | ilimitado¹ | limitado à cota |
| Ver catálogo compartilhado (uploads entre Pros) | não | sim | sim | não |
| Ler comentários em publicações | sim | sim | sim | sim |
| Comentar em publicações (comunidade) | **não** | sim | sim | **não** |
| Criar banda | não | não | **sim** | não |
| Ser dono de FreeBands (até 5 integrantes) | — | — | **sim** | — |
| Criar setlist pessoal | não | sim | sim | não |
| Ver músicas autorizadas pelo líder na banda | — | — | (é o dono) | **sim** |
| Comentar no setlist da banda | — | se membro | sim (própria banda) | **sim** |

¹ "Ilimitado" na prática = teto anti-abuso alto (hoje o código usa 500). A cota que trava o
usuário comum é a de **separação** (3/20/40), não a de compor.

**Duas classes de comentário distintas:**
- **Publicação/comunidade** → comentário na página da música (`comments`). Pro e ProBand escrevem; Free e FreeBand só leem.
- **Setlist da banda** → comentário no repertório da banda. Todo membro ativo (incluindo FreeBand) escreve. **Não existe hoje** — é tabela nova.

---

## 3. Lacunas do código atual

Levantado sobre o schema e as rotas reais (`src/db/schema.ts`, `src/lib/quota.ts`, `app/api/*`):

1. **Role `proband` não existe.** `users.role` só usa `free | pro | admin`; o gate padrão é
   `role === 'pro' || role === 'admin'`. ProBand não é reconhecido em lugar nenhum.
2. **Cota com valores e janela errados.** `src/lib/quota.ts` usa limites `FREE = 5` / `PRO = 500`
   e conta por **mês calendário** (`startOfMonth`). O combinado é `3 / 20 / 40` resetando pelo
   **ciclo de assinatura**, e não há caso para `proband` nem para `freeband`.
3. **Comentário de publicação não bloqueia ProBand corretamente.** `app/api/comments/route.ts`
   libera só `pro | admin` → ProBand seria barrado por engano. Precisa incluir `proband`.
4. **Comentário de setlist de banda não existe.** Nenhuma tabela/rota cobre "integrante comenta no
   setlist da banda".
5. **Sem limite de 5 integrantes por banda.** `band_members` não impõe teto.
6. **Visibilidade FreeBand não implementada.** Não há regra "integrante só vê as músicas que o
   líder autorizar".
7. **Autorização espalhada.** As checagens de role estão duplicadas rota a rota; não há uma função
   central de capacidade.

---

## 4. Mudanças de schema (descritas, não aplicadas)

- **`users.role`** — passar a aceitar `proband`. É `varchar`, então a mudança é de convenção +
  validação; sem migration de tipo. Atualizar o comentário do enum e `src/types/next-auth.d.ts`.
- **Cota por ciclo** — nenhuma tabela nova é obrigatória: a contagem pode continuar derivada de
  `processing_jobs` (como hoje), trocando a janela de "início do mês" para "início do ciclo".
  - Pro/ProBand: janela = `subscriptions.currentPeriodStart … currentPeriodEnd`.
  - Free/FreeBand: sem assinatura → janela = **aniversário mensal da conta** (`users.createdAt`
    projetado no mês corrente). Decidir e documentar essa âncora.
- **Comentário de setlist de banda** — tabela nova `setlist_comments`
  (`setlistId` → `setlists.id`, `userId`, `content`, `createdAt`; opcional `setlistSongId` para
  comentar por música). Escopo de acesso: membros ativos da banda dona do setlist + o líder.
- **Limite de integrantes** — sem coluna nova; enforcement em app na aceitação do convite
  (contar `band_members` ativos < 5). Opcionalmente `bands.maxMembers` default 5 para flexibilizar.

---

## 5. Camada de autorização (proposta)

Centralizar as regras num único módulo `src/lib/permissions.ts` para acabar com as checagens
soltas. Ideia de contrato (a detalhar na implementação):

- `resolveUserType(user, bandMembership?) → 'free' | 'pro' | 'proband' | 'freeband' | 'admin'`
  — combina `role` + vínculo de banda ativo.
- `can(userType, action)` — tabela de capacidades espelhando a Seção 2
  (`comment_publication`, `create_band`, `create_setlist`, `view_shared_catalog`, …).
- `separationLimit(userType) → 3 | 20 | 40` e `separationWindow(user, subscription)` — resolvem a
  cota e a janela do ciclo num só lugar; `src/lib/quota.ts` passa a consumir isso.

As rotas (`comments`, `setlists`, `upload/confirm`, banda) trocam suas checagens ad-hoc por
`can(...)`. Um único ponto de verdade evita divergência entre UI e API.

---

## 6. Passo a passo ordenado

**Etapa A — Fundação de papéis e cota**
1. Adicionar `proband` como valor válido de `users.role` (schema + `next-auth.d.ts` + comentário).
2. Criar `src/lib/permissions.ts` com `resolveUserType` e `can` (matriz da Seção 2).
3. Reescrever `src/lib/quota.ts`: limites `3 / 20 / 40`, janela por ciclo de assinatura (fallback
   aniversário para free/freeband), reconhecer `proband` e `freeband`.

**Etapa B — Enforcement nas rotas existentes**
4. `app/api/comments/route.ts`: incluir `proband` no gate de escrita; manter Free/FreeBand só leitura.
5. `app/api/upload/route.ts` + `.../upload/confirm/route.ts`: usar a nova cota por ciclo/role.
6. Rotas de setlist: bloquear criação para Free/FreeBand; liberar Pro/ProBand.
7. `app/api/songs/shared/route.ts`: restringir o catálogo compartilhado a Pro/ProBand/admin.

**Etapa C — Banda e integrantes**
8. Gate de criação de banda: só ProBand/admin.
9. Impor teto de 5 integrantes ativos por banda na aceitação de convite.
10. Regra de visibilidade FreeBand: integrante só enxerga músicas autorizadas pelo líder
    (definir "autorizar" = presença nas setlists da banda, ou flag explícita — **ponto em aberto**).

**Etapa D — Comentário de setlist de banda**
11. Criar tabela `setlist_comments` + migration.
12. API de leitura/escrita restrita aos membros ativos da banda (inclui FreeBand).
13. UI de comentários dentro do setlist da banda.

**Etapa E — UI e gatilhos de conversão**
14. Refletir capacidades na UI (esconder/desabilitar ações fora do papel) lendo `can(...)`.
15. Upsell nos limites: cota de separação estourada, comentar publicação bloqueado, criar
    setlist/banda bloqueado.

**Etapa F — Verificação**
16. Testar a matriz da Seção 2 papel a papel (free, pro, proband, freeband, admin) contra cada rota.
17. Validar reset de cota no virar do ciclo (assinante) e do aniversário (free).

---

## 7. Pontos em aberto (decidir antes/junto da implementação)

- **Âncora de cota do Free/FreeBand:** aniversário da conta ou dia 1º do mês? (impacta justiça vs. simplicidade).
- **"Autorizar música" para o FreeBand:** derivado das setlists da banda, ou controle explícito por música?
- **Teto "ilimitado" de composição do Pro/ProBand:** manter um número anti-abuso (ex.: 500) ou separar
  a cota de *compor* da cota de *separar*.
- **ProBand vs. assinatura Banda:** confirmar que `role = 'proband'` é setado pelo webhook de pagamento
  do plano Banda (liga com `bands.subscriptionId` já existente).
