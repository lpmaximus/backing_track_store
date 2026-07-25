# ADR-0005: Setlist, Ensaio e Fluxo de Informação da Banda — Pro, ProBand e FreeBand

**Status:** Aceito — pontos em aberto decididos com o usuário em 2026-07-25.
**Data:** 2026-07-25
**Relacionado:** [[ADR-0001]] (`0001-rbac-plano-papel-permissao.md`), [[ADR-0002]] (`0002-definicao-usuarios-funcionalidades.md`), [[ADR-0003]] (`0003-mvp-painel-administrativo.md`), ADR-BTS-004 (visão de comunidade)

---

## Contexto

O fundador descreveu a visão do Setlist em três recortes — Pro, ProBand (com "Modo Estudo" e "Modo Show") e FreeBand. Esta ADR confronta essa visão com o que já existe no código, registra os ajustes de modelagem e fecha o desenho do fluxo de informação entre os integrantes da banda.

A banda já consegue receber um repertório e conversar sobre ele. O que falta é o **ciclo de preparação**: dizer o que cada um deve estudar e saber se estudou.

| Peça | Estado |
|---|---|
| `setlists` (com `bandId` opcional) e `setlist_songs` (posição + nota por música) | pronto |
| `setlist_comments` — mural onde escreve inclusive o FreeBand | pronto |
| `bands` e `band_members` — instrumento, convite por token + QR, teto de 6 integrantes | pronto |
| Auto-mute por instrumento na página da música (`?solo=`) | pronto |
| Player com stems, velocidade, pitch, loop, metrônomo, cifra e letra sincronizadas | pronto |
| Ensaio / evento com data, local e pauta | não existe |
| Atribuição de estudo por músico e status de prontidão | não existe |
| Mixagem salva por música do setlist | não existe |
| Execução contínua do setlist (modo palco) | não existe |

## Decisão — Setlist, Evento e fluxo da banda

| # | Decisão |
|---|---|
| **D1** | O Setlist é o repertório. Ensaio e Show são **Eventos** datados que referenciam um setlist. Não existem "dois setlists". |
| **D2** | Na interface, o setlist de banda tem as abas **Repertório · Mixagem · Ensaios · Executar**. "Modo Estudo" e "Modo Show" são nomes de aba, não de entidade. |
| **D3** | O convite é para a banda (já implementado). No evento existe apenas **confirmação de presença**. |
| **D4** | Atribuição de estudo por (evento, música, integrante), com instrumento, foco em texto livre, trecho opcional para loop e **status de prontidão** de três níveis, editável pelo próprio integrante. |
| **D5** | Mixagem em **três camadas** — padrão do setlist, auto-mute do instrumento do integrante e override pessoal — com regra de resolução explícita e indicação visual do que foi aplicado automaticamente. |
| **D6** | O Pro solo usa o mesmo objeto Evento, sem participantes, rotulado **Sessão de estudo**, com auto-registro do que foi tocado. |
| **D7** | Na execução contínua, **um dispositivo é a fonte de áudio**. Sincronismo entre celulares fica fora do MVP e não deve ser prometido na comunicação. |
| **D8** | FreeBand tem playback das músicas dos setlists da sua banda; não cria setlist nem edita repertório; sugere música pelo mural. |
| **D9** | E-mail transacional em: evento criado, evento alterado ou cancelado, e "você foi escalado". Um digest por evento, não uma mensagem por atribuição. |

### 1. Setlist — User Pro (solo)

Abas **Repertório · Mixagem · Sessões · Executar**.

- **Repertório** — cria o setlist, adiciona músicas, ordena e anota por música. O rodapé mostra duração total e contagem.
- **Mixagem** — tela única: uma linha por música, uma coluna por stem (vocal, bateria, baixo, guitarra e harmonia — os cinco que o pipeline produz hoje), com M / S / volume. Acrescentar tom em semitons e velocidade por música: o player já suporta, e hoje isso vive perdido no campo de notas ("tocar 1 tom abaixo").
- **Sessões** — diário de prática: data, duração, o que foi tocado (pré-preenchido pelo player) e comentário livre. Sem convites e sem presença.
- **Executar** — modo palco (§6 abaixo).

Não vê: atribuições, presença, grade de prontidão nem mural.

### 2. Setlist — User ProBand (líder)

Tudo do Pro, mais:

- **Ensaios** — cria o evento com data, hora, local e duração; escolhe as músicas daquele ensaio; escreve o objetivo.
- **Escalação** — para cada música da pauta, atribui integrantes (o instrumento vem do cadastro do membro), com foco em texto ("solo a partir de 1:45") e trecho opcional que abre o player já em loop naquele ponto.
- **Grade de prontidão** — músicas nas linhas, integrantes nas colunas, semáforo nas células. É a tela que o líder abre na véspera.
- **Presença** — quem confirmou.
- **Ata** — depois do ensaio, marca cada música como *ok* ou *repetir*; o que ficou como repetir entra pré-selecionado no próximo ensaio.
- **Mural** — o `setlist_comments` que já existe, por setlist e por evento.

### 3. Setlist — User FreeBand (integrante)

Recebe pronto e responde. Vê:

- **Meu ensaio** — a tela inicial do evento, não o repertório inteiro: data, hora, local, botão de presença e o cartão do que é dele — músicas atribuídas, foco e o botão de tocar, que abre o player já com o instrumento dele no mix combinado e no trecho marcado.
- **Botão de prontidão** em cada atribuição, de um toque.
- **Repertório completo** em leitura, com playback: cifra, letra e a mixagem definida pelo líder.
- **Mural** — comenta no setlist e no ensaio; é por aqui que sugere música ou avisa que não vai.

Não faz: criar ou editar setlist, criar evento, escalar ninguém, nem mexer na mixagem padrão — só no próprio override.

### 4. Fluxo de informação

O ciclo, do repertório ao palco:

1. O ProBand monta o repertório e cria o ensaio com data, local e pauta.
2. Escala os integrantes por música, com foco e trecho; o sistema dispara o e-mail "você foi escalado".
3. O integrante confirma presença e estuda no player, com loop no trecho e o próprio instrumento mutado.
4. Marca **Pronto** e comenta as dúvidas — esta é a única seta que sobe do integrante para o líder, e é o ponto de virada de todo o desenho.
5. O líder vê a grade na véspera e ajusta a pauta.
6. No ensaio, a ata marca cada música como ok ou repetir; o que ficou como repetir vira pauta do próximo.
7. No show, o modo palco executa a sequência com os ajustes já definidos.

| Informação | Escreve | Lê |
|---|---|---|
| Repertório, ordem e notas | ProBand (Pro no setlist pessoal) | todos da banda |
| Mixagem padrão, tom e velocidade | ProBand | todos (aplicada no playback) |
| Override pessoal de mix | cada um, só o seu | só o dono |
| Evento, pauta e escalação | ProBand | todos da banda |
| Presença | cada um, só a sua | todos |
| Status de prontidão | o integrante escalado | todos da banda |
| Ata (ok / repetir) | ProBand | todos |
| Mural | todos, inclusive FreeBand | todos |

### 5. Mixagem em três camadas

Aplicadas nesta ordem, cada camada sobrescrevendo a anterior:

1. **Padrão do setlist** — definido pelo ProBand na aba Mixagem.
2. **Auto-mute do instrumento do integrante** — se `band_members.instrument = 'drums'`, a bateria entra mutada; reaproveita a lógica do `?solo=` já implementada.
3. **Override pessoal** — o que o integrante ajustou e salvou naquela música.

A interface precisa dizer qual camada agiu, com um indicador do tipo *"Bateria mutada — é o seu instrumento · desfazer"*. Sem isso, o suporte recebe "sumiu a bateria" toda semana.

### 6. Execução contínua (modo palco)

- **Pré-carregamento em janela deslizante**: enquanto toca a música N, carrega os stems da N+1 e descarta os da N−1. Um setlist de 20 músicas × 5 stems não cabe na memória de um celular de uma vez — este é o risco técnico real da funcionalidade.
- **Intervalo por música** (`gap_seconds`): 0 emenda, 3 segundos dão respiro, com contagem regressiva na tela.
- **Wake lock** (tela não apaga), fonte grande, alto contraste e botões dimensionados para dedo em palco escuro.
- **Cifra e letra rolando** por música — a `CifraView` com modo Automático já resolve isso; falta encadear.
- Indicador da próxima música, com tom e BPM.

Fora do MVP: se cada integrante der play no próprio celular, os aparelhos dessincronizam em segundos. Sincronismo entre dispositivos exige relógio comum e canal em tempo real (WebRTC ou timestamp de servidor) e é um projeto por si só. No MVP, um dispositivo toca — o ligado na mesa ou caixa — e os outros abrem o mesmo setlist em modo cifra.

### 7. Modelo de dados

Complementa `setlists`, `setlist_songs`, `setlist_comments`, `bands` e `band_members`, já existentes.

| Tabela | Colunas principais | Observação |
|---|---|---|
| `setlist_events` | `setlist_id`, `band_id` (null = sessão pessoal), `type`, `title`, `starts_at`, `duration_min`, `location`, `agenda`, `minutes`, `created_by` | `type` = rehearsal \| show \| practice |
| `setlist_event_attendance` | `event_id`, `user_id`, `status`, `responded_at` | `status` = yes \| no \| maybe; único por (evento, usuário) |
| `setlist_event_items` | `event_id`, `setlist_song_id`, `status`, `note` | pauta e ata; `status` = planned \| done \| repeat |
| `setlist_assignments` | `event_id`, `setlist_song_id`, `user_id`, `instrument`, `focus`, `loop_start_sec`, `loop_end_sec`, `readiness` | `readiness` = todo \| studying \| ready; único por (evento, música, usuário) |
| `setlist_song_mix` | `setlist_song_id`, `stem_key`, `state`, `volume` | padrão do setlist; `state` = on \| mute \| solo |
| `setlist_song_mix_user` | `setlist_song_id`, `user_id`, `stem_key`, `state`, `volume` | override pessoal |

Alterações em `setlist_songs`: `gap_seconds` (int, default 0), `transpose_semitones` (int, default 0) e `speed` (numeric, default 1.0).

Nota de custo: `setlist_song_mix` é uma linha por stem por música — cinco por música no pipeline atual, 150 num setlist de 30. Irrelevante no Neon. A alternativa (um `jsonb` em `setlist_songs`) economiza linhas mas complica consulta e migração; fica registrada como opção descartada.

## Minhas contribuições

1. **"Modo Estudo" e "Modo Show" não são dois setlists.** Na visão original, cada modo cria o seu próprio setlist. Isso obrigaria o líder a montar o repertório duas vezes e deixaria o ensaio órfão do show que ele prepara. Separar repertório (Setlist) de ocorrência datada (Evento) elimina a duplicação, preserva o histórico e não custa nada em complexidade de interface — os nomes Preparação e Execução continuam existindo como abas.

2. **O status de prontidão é a peça que fecha o ciclo.** Na visão original o FreeBand só recebe e comenta; o líder continua sem saber se a banda estudou e vai descobrir no ensaio, tarde demais para reagir. Um status de três níveis por atribuição, mudado com um toque, mais uma grade músicas × integrantes, custa uma tabela e uma rota `PATCH` — e é o item de maior relação valor/esforço de toda a ADR. É também a frase que vende o plano Banda: saber quem estudou o quê antes do ensaio.

3. **Mixagem tem de ser pessoal, não só do setlist.** Se o mix for único e definido pelo líder, o baterista toca junto com a bateria da gravação — exatamente o que o produto existe para evitar. As três camadas resolvem, desde que a interface mostre qual delas agiu.

4. **O convite é para a banda, não para o ensaio.** "Convidar os músicos para os ensaios" faria o integrante repetir o onboarding toda semana. O convite por token e QR já existe e é de banda; no evento basta confirmação de presença — um campo, não um fluxo.

5. **Pauta e ata são momentos distintos do mesmo ensaio.** A descrição junta "o que foi ensaiado" com "comentários". Separar o que se planeja (antes) do que aconteceu (depois), e fazer o que ficou marcado como repetir alimentar a pauta seguinte, é o que faz o registro continuar sendo usado na segunda semana em vez de virar um bloco de notas abandonado.

6. **A sessão de estudo do Pro precisa de auto-registro.** Para quem estuda sozinho não há convite nem distribuição — o objeto é um diário de prática. Mas campo de "o que treinei" preenchido à mão é campo que ninguém preenche. Como o app já sabe o que tocou e por quanto tempo, a sessão deve nascer preenchida e o usuário só acrescentar o comentário.

7. **Dizer agora que um só dispositivo toca.** "Executa sem parar" lido pela banda inteira vira "cada um dá play no seu celular", e o resultado é dessincronia em segundos. Registrar a limitação na ADR evita que ela seja prometida no material de venda e descoberta no primeiro show.

## Priorização — plano de implementação

Ordem decidida com o usuário: **ensaio e prontidão primeiro** — é o que diferencia o plano Banda e o que pode ser testado com uma banda real na semana seguinte.

| Fase | Entrega | Por quê primeiro |
|---|---|---|
| **S1 — Ensaio e prontidão** | Tabelas `setlist_events`, `setlist_event_attendance`, `setlist_event_items` e `setlist_assignments`; rotas (CRUD de evento só do líder, presença própria, pauta, escalação, `PATCH` de prontidão); aba Ensaios e página do ensaio com visão de líder e de integrante; e-mail de evento e de escalação; deep link do player com instrumento e trecho. | É o diferencial do plano Banda e o que pode ir para uma banda real em duas semanas. |
| **S2 — Mixagem e preparo** | `setlist_song_mix` e `setlist_song_mix_user`, tom e velocidade por música, `gap_seconds`, duração total do setlist e duplicar setlist. | Serve também ao Pro solo, que é a maioria hoje, e não depende de banda formada. |
| **S3 — Modo palco** | Execução contínua com pré-carga em janela deslizante, wake lock e tipografia de palco. | Prototipar a pré-carga isoladamente antes de construir a tela: é o único risco técnico real do documento. |

## Pontos decididos com o usuário (2026-07-25)

| # | Questão | Decisão |
|---|---|---|
| **D10** | O que o FreeBand consegue tocar quando o beta acabar | **O setlist inteiro da sua banda** — qualquer música do repertório, com cifra, letra e a mixagem do líder. Sem isso o Modo Estudo não funciona. |
| **D11** | Quem cria e edita ensaios e shows | **Só o líder (ProBand).** Sem coordenador delegado no MVP; papéis internos de banda já foram descartados no [[ADR-0003]] pelo mesmo motivo. |
| **D12** | Quem enxerga a grade de prontidão | **Toda a banda.** Ver o grupo se mexendo é metade do valor. Nunca exibir ranking, contagem histórica ou "quem mais atrasa" — só o estado atual. |
| **D13** | Pro convidado para uma banda | **Ocupa uma das 6 vagas e mantém o Pro próprio.** Seis é teto de integrantes, não de assinaturas. |
| **D14** | Limite de ensaios e shows | **Nenhum.** Evento é texto e data; o custo real do produto é separação de áudio. Limitar aqui só cria atrito. |
| **D15** | Nomenclatura na interface | Banda vê **Ensaios** e **Shows**; Pro solo vê **Sessões de estudo**. "Evento" existe só no banco. |

### Nota de implementação sobre D10

O comportamento decidido já está no código e não exige mudança: `hasProAccess` concede acesso Pro a membro ativo de banda com assinatura ativa. Três observações:

- A implementação atual é **mais generosa** que a decisão — libera o catálogo inteiro ao membro de banda, não só os setlists dela. Recomenda-se manter assim: é mais simples de explicar e de codificar, e o custo marginal é de banda de rede, não de processamento, já que a separação foi paga uma vez. Revisitar só se o egresso do R2 mostrar problema.
- A **quota de uploads continua por role** (`checkUploadQuota`): o FreeBand segue com 3 por mês e não herda os 40 da banda. Está correto e deve permanecer — é o processamento que custa.
- Antes de encerrar o beta, conferir que `BETA_FULL_ACCESS` foi removida do ambiente de produção e que um FreeBand real consegue tocar o setlist da banda.

## Consequências

**Positivas:** o plano Banda passa a ter um motivo de compra verbalizável numa frase — saber quem estudou o quê antes do ensaio — que nenhum concorrente de play-along entrega; a ligação escalação → trecho → loop no player usa o que o produto já tem de mais forte e é difícil de copiar sem os stems; o ensaio com pauta e ata dá ao líder um motivo recorrente para voltar ao produto entre um show e outro; e a tela única de mixagem, com tom e velocidade por música, serve ao Pro solo mesmo sem banda formada.

**Negativas / riscos a monitorar:** seis tabelas novas e três telas ampliam a superfície de manutenção antes do lançamento; a pré-carga em janela deslizante é a parte tecnicamente arriscada e pode não caber na memória de celulares mais modestos, o que mudaria o desenho do modo palco; o modo palco cria expectativa de confiabilidade em situação de show, onde a falha é visível e cara, e exige um aviso claro de manter o áudio também salvo localmente; e a grade de prontidão visível a toda a banda tem custo social — se algum dia virar ranking ou histórico, afunda o produto dentro do grupo.
