# ADR-0001: Modelo RBAC (Plano × Papel × Permissão) e limites de separação por tier

**Status:** Aceita
**Data:** 2026-07-18
**Relacionado:** `docs/ESTRUTURA-USUARIOS-PLANO.md` (plano de implementação, 2026-07-17), `docs/EVT-backingtrack.store.md`

---

## Contexto

O backingtrack.store pivotou para um modelo estilo Moises (usuário faz upload do próprio áudio, a plataforma separa stems via Demucs self-hosted), diferenciando-se por foco em banda/colaboração — não em qualidade de separação, onde não há como competir com o Moises (70M usuários, US$50,2M captados, modelo proprietário treinado com musicólogos).

O modelo de contas em uso descrevia `users.role` com três valores (`free`, `pro`, `proband`) e tratava o integrante de banda gratuito ("FreeBand") como um quarto tipo implícito, sem separar claramente **o que o usuário paga** (plano) de **o que ele pode fazer dentro de uma banda específica** (papel). Isso não sustenta o caso real de um músico profissional participar de várias bandas com papéis diferentes (ex.: Pro na banda A, líder da banda B) sem trocar de conta.

Em 2026-07-18 uma proposta externa (avaliada com o usuário) recomendou formalizar três camadas independentes — Plano, Papel, Permissão — e levantou pontos adicionais (limites de separação, armazenamento, permissão por trilha, convites, plano Pro Studio). As seções abaixo registram o que foi decidido a partir dessa proposta.

## Decisão

**1. Três camadas independentes de autorização, não um único enum:**

- **Plano (Subscription):** `free`, `pro`, `proband` (+ `admin` interno) — em `users.role`, determina limites de uso (separações/mês) e features individuais do usuário.
- **Papel (Role) dentro de uma banda:** vínculo em `band_members`, não em `users`. Hoje só existe "membro ativo"; papéis adicionais (Manager, Guest) ficam como extensão futura, sem necessidade de mudar o schema de plano.
- **Permissão:** função central `can(userType, action)` (proposta em `docs/ESTRUTURA-USUARIOS-PLANO.md` §5) resolve capacidades a partir de plano + papel, substituindo checagens de role espalhadas rota a rota.

**FreeBand não é um tipo de conta gravado.** É estado derivado: `role = 'free'` **e** membro ativo de uma banda (`band_members.status = 'active'`). Evita duplicar estado e mantém "integrante é um free com poderes extras dentro da banda" — essa parte já estava correta no plano de 2026-07-17 e é mantida.

**2. Limites de separação por tier:**

| Plano | Separações/mês | Export | Anunciado? |
|---|---|---|---|
| Free | 3 | **completo** | sim |
| FreeBand | 3 (herda do Free) | completo | sim |
| Pro | 20 | completo | **sim** — número público |
| ProBand | 40 | completo | **sim** — número público |

**Por que o Free tem export completo, não amostra curta:** revertido em 2026-07-18 (segunda revisão do mesmo dia) — a versão anterior ("amostra curta ~15-20s" para reduzir custo) foi descartada em favor de liberar as 3 faixas completas como jogada de fidelização/funil: deixar o usuário sentir o produto por inteiro converte melhor do que uma amostra frustrante. Se a base Free crescer muito e o custo de GPU (~R$0,15-0,45/separação × 3/usuário/mês) pesar no caixa, essa política é a primeira a ser revisitada — o próprio usuário marcou isso como gatilho explícito de revisão, não como decisão definitiva.

**Por que os caps do Pro/ProBand são públicos, não escondidos:** decisão revertida em 2026-07-18 — o usuário determinou que nenhum limite deve ficar oculto: "não vamos esconder nenhum dado do usuário, ele deve saber o que está comprando". Transparência tem prioridade sobre a tática de marketing de "ilimitado com trava invisível". Qualquer página de preços, tela de conta ou painel admin deve mostrar o limite real (20/mês Pro, 40/mês ProBand) como número público, e o uso do próprio usuário (ex.: "14/20 separações usadas este mês") deve aparecer na conta dele, não só no admin. Isso também simplifica a implementação: não existe mais a distinção "número real vs. número anunciado".

**3. Pro Studio (plano futuro para produtores) complementa, não substitui, o marketplace de produtores da Fase 3** do roadmap. Os dois entram juntos no planejamento quando a Fase 3 chegar; prioridade entre eles não foi definida.

## Alternativas consideradas

- **Tratar FreeBand como quarto tipo de conta gravado em `users.role`.** Rejeitada: duplica estado (a mesma informação já existe em `band_members`), e não escala pro caso de um usuário com papéis diferentes em bandas diferentes.
- **Free sem nenhuma separação própria (só catálogo compartilhado).** Considerada como opção mais conservadora de custo; rejeitada em favor de manter 3/mês como isca de conversão.
- **Free com separação limitada a amostra curta (~15-20s de export).** Considerada e revertida no mesmo dia (2026-07-18): a lógica de reduzir custo/valor percebido perdeu para a lógica de fidelização — a aposta é que a experiência completa (mesmo limitada em quantidade) converte melhor para Pro do que uma amostra frustrante.
- **Pro com separações ilimitadas (paridade com Moises pago).** Rejeitada: sem a margem de capital do Moises, um limite realmente ilimitado é risco financeiro não coberto pelo modelo atual — optou-se por cap fixo (20/40) exibido publicamente ao usuário, não por um teto ilimitado.
- **Cap de fair-use escondido do usuário (não anunciado na página de preço).** Considerada inicialmente em 2026-07-18, revertida no mesmo dia: o usuário determinou que nenhum limite deve ficar oculto — "ele deve saber o que está comprando". Transparência do limite tem prioridade sobre a tática de "ilimitado com trava invisível".

## Consequências

**Positivas:** suporta múltiplas bandas com papéis diferentes por usuário sem redesenho de schema; centraliza autorização num único módulo (`resolveUserType` + `can`), eliminando checagens duplicadas por rota; separa claramente o que é decisão de produto (plano) do que é decisão de contexto (papel na banda); export completo no Free (não amostra) dá ao usuário a experiência real do produto, reforçando o funil de conversão para Pro.

**Negativas / custos a monitorar:** 3 separações/mês grátis por usuário Free, agora com export completo, é custo real de GPU sem receita direta (~R$0,15-0,45/separação × 3/usuário/mês) — não entrou no modelo de margem/CAC até esta decisão. **Gatilho de revisão explícito do usuário:** se a base de usuários Free crescer muito e esse custo passar a pesar no caixa, esta é a primeira política a ser revisitada — não é uma decisão definitiva.

## Itens levantados mas não decididos nesta ADR (backlog)

- Limite de armazenamento por GB por tier (Free/Pro/ProBand) — sinalizado como lacuna real no modelo financeiro, não votado.
- Sistema de convites de banda (e-mail / QR code / link temporário) — sem fase definida.
- Permissão por trilha/música (integrante só vê o instrumento autorizado) — já é o MVP do diferencial de banda/ministério, não "feature futura"; ainda não movida para uma fase concreta do roadmap.
- Âncora da janela de cota do Free/FreeBand (aniversário da conta vs. dia 1º do mês) — ponto em aberto já registrado em `docs/ESTRUTURA-USUARIOS-PLANO.md` §7.
- UI de conta/admin para exibir uso vs. limite (ex.: "14/20 separações usadas este mês") — decorre da decisão de transparência de 2026-07-18, ainda não implementada.
