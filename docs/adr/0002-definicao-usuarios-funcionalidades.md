# ADR-0002: Definição de Usuários e Funcionalidades por Plano/Papel

**Status:** Em avaliação — a matriz base (colunas Free/Pro/ProBand/FreeBand já decididas em conversas anteriores) está fechada; itens marcados como **[proposto]** são contribuição desta ADR, pendentes de confirmação do usuário.
**Data:** 2026-07-18
**Relacionado:** [[ADR-0001]] (`0001-rbac-plano-papel-permissao.md`), `docs/ESTRUTURA-USUARIOS-PLANO.md` (2026-07-17)

---

## Contexto

O ADR-0001 fechou o modelo de autorização (Plano × Papel × Permissão) e os limites de separação por tier. Faltava consolidar num único lugar **todas** as funcionalidades de cada tipo de usuário — hoje espalhadas entre a proposta externa avaliada em 2026-07-18, o `docs/ESTRUTURA-USUARIOS-PLANO.md` (matriz de permissões de 2026-07-17) e as decisões de pricing originais (`project_backingtrack` memory, pré-pivô). Esta ADR consolida essas três fontes numa matriz única e adiciona recomendações novas.

Quatro perfis de usuário, conforme ADR-0001:

- **Free** — `role = 'free'`, sem vínculo de banda ativo.
- **Pro** — `role = 'pro'`.
- **ProBand (Líder)** — `role = 'proband'`, dono de uma ou mais bandas.
- **FreeBand (Integrante)** — `role = 'free'` **e** membro ativo de uma banda. Não é um plano; é estado derivado.

## Decisão — Matriz de funcionalidades

| Capacidade | Free | Pro | ProBand (Líder) | FreeBand (Integrante) |
|---|---|---|---|---|
| Separações de áudio / mês | 3 | 20 | 40 | 3 (herda do Free) |
| Export do áudio separado | completo | completo | completo | completo |
| Uploads/composições próprias | limitado à cota | ilimitado¹ | ilimitado¹ | limitado à cota |
| Catálogo compartilhado (ver uploads de outros Pros) | não | sim | sim | não |
| Ler comentários da comunidade | sim | sim | sim | sim |
| Comentar em publicações da comunidade | não | sim | sim | não |
| Criar setlist pessoal | não | sim | sim | não |
| Criar banda | não | não | sim (até 5 integrantes/banda²) | não |
| Convidar integrantes / distribuir repertório | não | não | sim | não |
| Ver músicas autorizadas pela banda | — | — | (é o dono) | sim |
| Comentar no setlist da banda | — | se membro | sim | sim |
| Modo Performance | não | sim | sim | sim (via banda) |
| Offline / PWA | não | sim | sim | não |
| Histórico | 30 dias | ilimitado | ilimitado | 30 dias |
| Baixar PDF da cifra (quando permitido) | não³ | sim | sim | sim |
| Permissão por trilha/música (per-instrumento)⁴ | n/a | n/a | define | recebe |
| Armazenamento (GB) | **fora de escopo do MVP** — sem teto por enquanto | **fora de escopo do MVP** | **fora de escopo do MVP** | **fora de escopo do MVP** |

¹ "Ilimitado" na prática = teto anti-abuso alto (hoje 500 no código) — a cota que trava o usuário comum é a de separação, não a de compor.
² Limite de 5 integrantes por banda já decidido em `docs/ESTRUTURA-USUARIOS-PLANO.md` §5. O número de **bandas** que um ProBand pode criar/possuir (a proposta externa sugeriu até 5 bandas) **não estava decidido antes** — ver "Pontos em aberto".
³ Free não está em banda, então não há cifra de banda para baixar; download de cifra de música própria não foi avaliado.
⁴ Feature nova, ainda não implementada — ver recomendação abaixo.
⁵ **Decisão do usuário (2026-07-18): armazenamento não entra no MVP.** Sem teto por usuário até que o produto tenha volume real para justificar o esforço de medir e validar contra o modelo financeiro.

## Minhas contribuições

**1. Priorizar a permissão por trilha/música — não é feature futura, é o MVP do diferencial.**
Guitarrista abre só guitarra + cifra; baterista só bateria + clique; vocal só voz-guia. Isso já estava validado como o nicho vencedor (ministério de louvor) desde o pivô ([[project_backingtrack_pivot]]), mas nunca virou item de uma fase concreta do roadmap. Recomendo mover para a Fase 1.5/2, antes de features de polimento (loop A-B, diagramas de acorde) — sem isso, "banda" no produto é só uma lista de membros vendo tudo, que é exatamente o que já existe em qualquer WhatsApp de grupo.

**2. Separar "quantas bandas um Líder pode criar" de "quantos integrantes cabem numa banda".**
São dois limites diferentes, e só o segundo (5 integrantes/banda) estava decidido. Um músico profissional real costuma tocar em 2-3 projetos (banda autoral + ministério + banda de casamento). Recomendo **não capar o número de bandas do ProBand no lançamento** — o custo marginal de uma banda extra é praticamente zero (é só uma linha em `bands`), e capar sem necessidade técnica só cria fricção comercial sem proteger margem nenhuma. Se abuso virar problema real, é fácil adicionar um teto depois.

**3. Adicionar o papel "Guest" (convidado pontual) — músico substituto de show, não integrante fixo.**
Cenário comum: banda de casamento chama um baixista avulso para um show específico. Hoje o modelo só tem "Membro ativo" permanente. Proponho um papel `guest` em `band_members` com acesso de leitura + Modo Performance a **uma setlist específica** (não à banda toda), com expiração automática (ex.: 48h após a data do evento). Resolve um caso de uso real do nicho de banda de evento sem exigir convite formal nem contar na cota de 5 integrantes.

**4. Convite por QR code como prioridade sobre e-mail/link, para o nicho ministério.**
A proposta externa listou e-mail, QR code e link temporário como opções equivalentes. No caso de ensaio/culto presencial — o cenário mais forte do nicho — QR code é o que resolve na prática: integrante escaneia na hora, sem digitar e-mail em teclado de celular durante ensaio. Recomendo QR code como MVP do convite, e-mail/link como iteração seguinte.

**5. Download de PDF da cifra: liberar para todos os planos pagos, não só FreeBand.**
A proposta original listava "baixar PDF da cifra" só para o Integrante Free. Não há motivo para negar isso a Pro/ProBand — cifra em PDF não é a mesma categoria de risco que download de áudio (que é bloqueado de propósito para reter o assinante no streaming, ver [[project_backingtrack]]). Recomendo liberar para os quatro perfis quando a cifra permitir.

## Pontos em aberto (decidir com o usuário)

- Confirmar se o ProBand tem teto de bandas criadas (recomendo não capar no lançamento — ver contribuição 2).
- Confirmar a adoção do papel "Guest" e o mecanismo de expiração automática.
- Priorizar QR code como mecanismo de convite MVP (ou manter as três opções em paralelo).
- Confirmar liberação de download de PDF de cifra para todos os planos.
- Mover a permissão por trilha/música para uma fase concreta do roadmap (recomendo Fase 1.5/2).

## Consequências

**Positivas:** consolida numa única tabela o que hoje está espalhado em três documentos, reduzindo risco de divergência entre o que a UI mostra e o que o backend impõe; separar "bandas por líder" de "integrantes por banda" evita capar o produto sem necessidade técnica real; o papel Guest cobre um caso de uso real (músico avulso) sem inflar a cota permanente de integrantes.

**Negativas / riscos a monitorar:** sem teto de armazenamento no MVP, um usuário outlier (poucos, mas possíveis) pode acumular volume desproporcional de uploads sem limite técnico — aceitável por ora, mas precisa entrar no radar quando o produto tiver volume real; papel Guest adiciona uma terceira categoria de vínculo em `band_members` (Member/Guest/futuro Manager), aumentando a superfície da função `can()` que o ADR-0001 propôs centralizar.
