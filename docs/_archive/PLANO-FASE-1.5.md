# Plano de Refatoração — Fase 1.5 (Pivô Técnico)
## backingtrack.store

**Data:** 2026-07-11 | **Base:** EVT-001 v5.0 | **Status:** Proposto | **Versão:** 1.2

Este plano detalha, arquivo por arquivo, como sair do estado atual (catálogo administrado manualmente, sem upload de usuário, sem colaboração) para o modelo descrito no EVT v5: upload próprio → separação de stems → cifra colaborativa → banda. Foi desenhado em cima do código real do repositório (lido em 2026-07-11), não do zero.

> **Nota da v1.1 (revisão de viabilidade, 2026-07-11):** após conferência do plano contra o código real, foram incorporados os pontos que faltavam correção — segurança do webhook, política de retenção do áudio original, controle de abuso/custo do upload, o refactor `hasProAccess` como passo isolado, a premissa de dedup no modelo de custo e a ausência de infraestrutura de teste. Trechos novos ou corrigidos estão marcados com **[v1.1]**.

> **Nota da v1.2 (segunda revisão contra o código, 2026-07-11):** oito lacunas adicionais incorporadas, duas bloqueantes para a migration do passo 1: (1) colunas NOT NULL de `songs` incompatíveis com upload de usuário; (2) ausência de vínculo usuário↔música para cache hit e quota (nova tabela `user_songs`). As demais: stems em URL pública do R2, staleness do JWT, webhook Asaas sem noção de banda, taxonomia de stems do Demucs vs. instrumentos da banda, validação server-side do confirm (hash/tamanho), e termos de uso/consentimento na UI de upload. Trechos marcados com **[v1.2]**.

---

## 0. Estado atual (o que já existe e será reaproveitado)

- **Schema (`src/db/schema.ts`):** `songs` (catálogo, um `audioUrl` + `chords` jsonb + `cifraText`), `stems` (1:N com `songs`, upload manual do admin), `users` (role free/pro/admin), `subscriptions` (Asaas), `comments`, `setlists`/`setlistSongs` (dono único, `userId`).
- **Upload:** só existe `/api/admin/upload-url` (presigned R2), protegido por senha de admin — não existe upload de usuário final.
- **Player:** `SongPlayer.tsx` + `WavePlayer.tsx` já leem `stems[]` e alternam mute por instrumento, já têm pitch/velocidade (Tone.js) e cifra sincronizada por timecode (`ChordDisplay`). **Isso não muda de forma nenhuma** — o player já é agnóstico de onde vieram os stems.
- **Setlists:** modelo de dono único (`setlists.userId`), sem noção de banda/compartilhamento.
- **Auth:** NextAuth v5, `auth.config.ts` (edge-safe, usado no middleware) separado de `auth.ts` (completo, usado nas rotas). **Regra a respeitar:** qualquer código novo que rode no middleware não pode importar nada que toque `src/db` no topo do módulo.

O ponto central do refactor: hoje `songs` é uma tabela curada só pelo admin. Ela precisa virar uma tabela que também recebe registros criados por upload de usuário, com um pipeline assíncrono de processamento no meio — sem quebrar o que já lê `songs`/`stems` hoje.

---

## 1. Mudanças de Schema

Novas tabelas e colunas, todas aditivas (não quebram o que existe):

```
songs
  + sourceType        varchar   'admin' | 'user_upload'   default 'admin'
  + uploadedByUserId   integer  FK users.id, nullable
  + sourceHash         varchar(64)  unique, nullable   -- SHA-256 do arquivo original, dedupe de catálogo
  + processingStatus   varchar   'ready' | 'queued' | 'separating' | 'transcribing' | 'failed'   default 'ready'
  + chordsSource       varchar   'admin' | 'auto' | 'community'   default 'admin'
  + chordsStatus       varchar   'draft' | 'validated'   default 'validated'  (admin sempre validated)
  ~ genre, key, bpm    → tornar NULLABLE (ver nota [v1.2] abaixo)

processing_jobs
  id, songId FK, userId FK users.id,   -- [v1.2] quem disparou o job (quota por usuário)
  provider varchar ('replicate_demucs'), providerJobId text,
  stage varchar ('separation' | 'chord_detection'), status varchar ('pending'|'running'|'done'|'failed'),
  errorMessage text, createdAt, completedAt

user_songs   -- [v1.2] biblioteca: vincula usuário a música (upload próprio OU cache hit)
  id, userId FK, songId FK, via varchar ('upload'|'cache'), createdAt
  unique (userId, songId)

cifra_edit_history
  id, songId FK, userId FK, previousChords jsonb, newChords jsonb,
  previousCifraText text, newCifraText text, createdAt

cifra_reports
  id, songId FK, reportedByUserId FK, reason text, status varchar ('open'|'resolved'|'dismissed'), createdAt

bands
  id, name, leaderUserId FK users.id, subscriptionId FK subscriptions.id nullable, createdAt

band_members
  id, bandId FK, userId FK nullable, invitedEmail text nullable,
  instrument varchar, status varchar ('invited'|'active'), joinedAt

setlists
  + bandId   integer FK bands.id, nullable   -- null = setlist pessoal (comportamento atual, sem mudança)
```

**Por que `bands` separado de `setlists`:** uma banda tem repertório recorrente (ensaio de quinta, culto de domingo, show de sábado) — várias setlists, mesmos membros. Colocar membership direto em `setlists` obrigaria reconvidar a banda toda a cada setlist nova. Com `bands` + `band_members`, convida uma vez; toda setlist com aquele `bandId` herda a lista de membros.

**[v1.2] BLOQUEANTE — NOT NULL de `songs` vs. upload de usuário:** hoje `title`, `artist`, `genre`, `key` e `bpm` são `notNull` e `slug` é `unique` (ver `src/db/schema.ts`). No momento do `confirm` de um upload, nenhum desses dados existe. Decisão para a migration: tornar `genre`, `key` e `bpm` nullable (a UI trata ausência como "detectando…" e o pipeline preenche depois); `title`/`artist` vêm de um formulário mínimo na tela de upload (pré-preenchido por metadados ID3 se houver); `slug` gerado como `slugify(artist-title)` + sufixo curto do hash em caso de colisão. Isso muda a migration do passo 1 — decidir antes de gerá-la.

**[v1.2] BLOQUEANTE — vínculo usuário↔música (`user_songs`):** sem essa tabela, (a) quem recebe cache hit não tem como reencontrar a música na própria conta, e (b) a quota não enxerga uso de quem não gerou job. Regra: todo `confirm` cria `user_songs` (via `'upload'` ou `'cache'`); a quota mensal free conta `processing_jobs` do usuário no mês (jobs reais, não cache hit, não `failed`) — daí o `userId` novo em `processing_jobs`.

**Por que `sourceHash` em vez de fingerprint acústico agora:** hash de arquivo (SHA-256) é trivial de calcular e resolve o caso mais comum (mesmo usuário ou colega reenviando o mesmo MP3). Fingerprint acústico (tipo Chromaprint, que reconhece a mesma música em encodings diferentes) é upgrade de Fase 2 — não bloqueia o MVP do pivô.

---

## 2. Frente A — Fila de Upload + Separação (adapter abstrato)

**Arquivos novos:**

- `src/lib/separation/types.ts` — interface `SeparationProvider { submit(audioUrl: string): Promise<{providerJobId: string}>; }` + tipo de webhook payload normalizado.
- `src/lib/separation/replicate.ts` — implementação concreta chamando a API do Replicate (modelo Demucs), único provider na Fase 1.5. Nenhuma outra parte do código deve importar `replicate` diretamente — sempre via a interface.
- `app/api/upload/route.ts` — **[v1.1] código praticamente novo, não "a mesma lógica de `admin/upload-url`".** A rota admin autentica por header `x-admin-password` e não toca em sessão nem no banco (ver `app/api/admin/upload-url/route.ts`, linhas 26-30). O upload do usuário final é outra coisa: exige sessão NextAuth (`auth()`), resolve o `userId`, aplica quota por role e só então emite a presigned URL do R2. Só a parte de assinatura R2 (S3Client + `getSignedUrl`) é reaproveitável. Quota: free = N/mês, pro = ilimitado/teto alto — contar em `processing_jobs` do mês corrente **apenas jobs que não sejam cache hit e não estejam `failed`** (ver regra de contagem em Frente B e no risco de abuso na Seção 10).
- `app/api/upload/confirm/route.ts` — depois do PUT direto pro R2, o browser chama essa rota com a `key` final. Aqui: calcula/recebe o hash (ver Frente B), cria (ou reaproveita) o registro em `songs`, cria `processing_jobs` com stage `separation`, chama `SeparationProvider.submit()`.
- `app/api/webhooks/separation/route.ts` — endpoint que o Replicate chama de volta quando a separação termina. Popula `stems` (mesma tabela que já existe, mesmo formato que o admin usa hoje — o player não precisa saber a origem), atualiza `processing_jobs.status`, dispara a Frente C (chord detection) se `chordsStatus` ainda for vazio para aquela música.
  - **[v1.1] Segurança obrigatória (não era mencionada):** este endpoint é público (o Replicate precisa alcançá-lo). Sem autenticação, qualquer um pode fazer POST fingindo "separação pronta" e injetar `stems` arbitrários numa música. O handler **deve** (1) validar a assinatura do webhook do Replicate (header de assinatura + secret guardado em env) antes de confiar no payload, e (2) ser **idempotente**: checar se aquele `processing_jobs.providerJobId` já foi processado antes de inserir stems — senão um reenvio do webhook (o Replicate reenvia em caso de timeout) duplica linhas em `stems`, que hoje não tem constraint de unicidade. Processar em transação: marcar o job `done` e inserir os stems atomicamente.

**Por que assíncrono via webhook, não síncrono:** funções serverless da Vercel têm limite de tempo de execução; separação de áudio leva de segundos a minutos. Replicate já é nativamente assíncrono (você inicia uma "prediction" e recebe callback), então não precisa de fila própria (Redis/BullMQ) nesta fase — o próprio Replicate atua como a fila.

**[v1.1] Política de retenção do áudio original (não estava definida — cruza com a mitigação de direitos autorais do EVT 5.1):** o EVT diz "sem re-hospedar áudio original", mas tanto a separação (Frente A) quanto a detecção de acorde (Frente C, Music.ai) precisam do mix original acessível por URL no R2, ao menos transitoriamente. Regra a fixar: o mix original enviado pelo usuário é armazenado no R2 **apenas enquanto o pipeline roda**; assim que os stems ficam prontos (e a cifra automática é gerada, se for o caso), o objeto do mix original é **apagado do R2**, mantendo-se somente os stems. Se a música tiver `sourceType = 'admin'` (curadoria, domínio público), o mix pode ser mantido. Essa deleção deve ser disparada no fim do webhook, depois de confirmar sucesso das duas etapas. É este passo que sustenta juridicamente o pivô — não pode ficar implícito.

**[v1.2] Validação server-side no `confirm` (não confiar no browser):** o hash calculado no client é conveniência, não verdade — um client malicioso pode declarar o hash de *outra* música e associar stems errados a um `sourceHash` (envenenamento de catálogo), ou declarar hash já existente para furar quota. E a presigned PUT não limita tamanho — um WAV de 2 GB gera custo real de R2 + GPU. No `confirm`, antes de criar o job: (1) `HeadObject` no R2 para confirmar que o objeto existe e validar `ContentLength` (teto ex.: 100 MB) e `ContentType`; (2) recomputar o SHA-256 no servidor — via stream do objeto ou delegado ao worker de separação — e usar esse valor como `sourceHash`, tratando o hash do client apenas como pré-checagem de cache otimista.

**[v1.2] Taxonomia de stems — Demucs vs. instrumento da banda:** o Demucs padrão (htdemucs) devolve `vocals/drums/bass/other` — guitarra, teclado e violão caem juntos em "other", o que enfraquece a trilha-guia por instrumento da Frente E (coração do diferencial). Avaliar desde já o `htdemucs_6s` (6 stems: + guitar/piano), que muda custo por música e o mapeamento para `stems.instrument` (hoje `drums|bass|guitar|harmony|melody`). Definir a tabela de mapeamento provider→instrument dentro do adapter (`replicate.ts`), não no webhook.

**[v1.2] Acesso aos stems — URL pública do R2:** hoje tudo é servido via `R2_PUBLIC_URL` (link público permanente). Para conteúdo de upload de usuário isso (a) mina o gate free/pro — qualquer um com o link baixa o stem — e (b) enfraquece a postura jurídica ("processamos para quem enviou", não "distribuímos para quem tiver o link"). Decisão mínima para a Fase 1.5: servir stems de `sourceType='user_upload'` por presigned GET de curta duração emitida por rota autenticada que checa `user_songs`/banda; conteúdo `admin` (domínio público) pode continuar público. Se o custo de latência incomodar, otimizar depois (Worker/token) — mas não lançar upload de usuário com stem em URL pública.

**[v1.2] Termos de uso + consentimento (a mitigação jurídica precisa existir na UI):** o EVT 5.1 apoia o pivô em "termos de uso + takedown ágil", mas isso não estava em nenhuma frente. Entra na Frente A: página `/termos` (declaração de que o usuário detém direitos sobre o áudio enviado, uso pessoal/de ensaio, política de takedown com contato), checkbox obrigatório na tela de upload ("declaro que possuo os direitos…") com aceite registrado (timestamp no `user_songs` ou tabela própria), e link de denúncia/takedown no rodapé. Sem isso, a deleção do mix original sustenta só metade do argumento.

**UI nova:** tela de upload (`app/upload/page.tsx`, protegida por auth) com estado de progresso ("enviando" → "separando stems" → "pronto"), poll simples em `processing_jobs.status` a cada poucos segundos até `done` — sem necessidade de WebSocket no MVP. **[v1.2]** Inclui formulário mínimo de `title`/`artist` (pré-preenchido via ID3 quando possível) e o checkbox de declaração de direitos.

---

## 3. Frente B — Cache de Catálogo por Hash

**Onde entra:** dentro de `app/api/upload/confirm/route.ts`, antes de criar o `processing_job`.

1. Calcular SHA-256 do arquivo (pode ser feito no browser antes do upload, enviado junto no confirm — evita subir o arquivo duas vezes se já existe).
2. `SELECT * FROM songs WHERE source_hash = ?`.
3. Se existir: não cria novo job de separação nem novo registro de `songs` — cria `user_songs` com `via: 'cache'` **[v1.2]** (é isso que dá ao usuário acesso à música na conta dele) e retorna os stems já prontos. Custo marginal: zero.
4. Se não existir: segue o fluxo normal da Frente A.

**Consequência de produto direta:** isso é o que sustenta a economia descrita no EVT (Seção 6.1) — o custo de separação e de detecção de acorde só é pago uma vez por música, não por usuário.

**[v1.1] Ressalva sobre a taxa real de dedup (ajustar expectativa no EVT):** o `sourceHash` é SHA-256 do *arquivo*, não da *música*. Dois usuários com rips/encodings diferentes da mesma faixa geram hashes diferentes e reprocessam tudo — ou seja, o dedup por byte exato entre usuários distintos tende a ser **baixo** na prática. O cache resolve bem o caso "mesmo usuário ou colega reenviando o mesmo MP3", mas não o caso "todo mundo tem seu próprio arquivo da mesma música". Portanto o custo amortizado do EVT (cifra paga "uma vez por música") só se materializa de verdade com fingerprint acústico (Chromaprint, Fase 2). Até lá, planejar o caixa assumindo custo **próximo do cheio** por upload, não do amortizado. Não bloqueia a Fase 1.5, mas deve ser registrado no EVT 6.1/6.3.

**[v1.1] Concorrência na inserção do hash:** `songs.sourceHash` é `unique`. Dois uploads simultâneos do mesmo arquivo podem passar os dois pelo `SELECT ... WHERE source_hash = ?` (passo 2) antes de qualquer inserção e tentar criar dois registros. Tratar com `INSERT ... ON CONFLICT (source_hash) DO NOTHING` (upsert do Drizzle) e reler o registro vencedor, em vez de confiar só no SELECT prévio.

---

## 4. Frente C — Integração Music.ai (rascunho de cifra)

**Arquivos novos:**

- `src/lib/chords/types.ts` — interface `ChordDetectionProvider { detect(audioUrl: string): Promise<ChordSection[]>; }`, mesmo padrão de adapter da Frente A.
- `src/lib/chords/musicai.ts` — implementação chamando o módulo de transcrição de acorde/chave da Music.ai.
- Gatilho: dentro do webhook da Frente A (`app/api/webhooks/separation/route.ts`), depois que os stems ficam prontos, checar `songs.chordsStatus`. Se a música é nova (não veio do cache da Frente B) e não tem cifra: chamar `ChordDetectionProvider.detect()`, salvar resultado em `songs.chords` com `chordsSource: 'auto'`, `chordsStatus: 'draft'`.

**Importante (regra do EVT, Seção 3.3):** essa chamada só acontece uma vez por música nova — nunca por play de usuário. A Frente B já garante isso ao evitar reprocessamento de música já hasheada.

---

## 5. Frente D — Cifra Colaborativa + Moderação

**Schema:** `cifra_edit_history` e `cifra_reports` (Seção 1).

**Arquivos novos:**

- `app/api/songs/[id]/chords/route.ts` — `PATCH`, exige `role === 'pro' || 'admin'`. Recebe `{ chords?: ChordSection[], cifraText?: string }`, grava snapshot anterior em `cifra_edit_history`, atualiza `songs` com `chordsSource: 'community'`, `chordsStatus: 'validated'`.
- `app/api/songs/[id]/chords/report/route.ts` — `POST`, qualquer usuário logado pode reportar uma cifra como errada (`cifra_reports`).
- `app/admin/moderacao/page.tsx` — lista `cifra_reports` abertos + `cifra_edit_history` recente, com botão de reverter (reaplica `previousChords`/`previousCifraText` de um registro do histórico).

**Mudança em componente existente:** `SongPlayer.tsx` já tem `ChordDisplay`/`CifraText` renderizando `song.chords`/`song.cifraText` — não muda a leitura. O que entra é um modo de edição: adicionar um componente novo `ChordEditor.tsx` (client), acionado por um botão "Sugerir correção" visível só para Pro, que abre um formulário estruturado (lista de seções com timecode + string de acordes) espelhando o formato de `ChordSection` que já existe no schema. Ao salvar, chama o `PATCH` acima e recarrega.

**Indicador visual:** quando `chordsStatus === 'draft'`, mostrar badge "cifra automática, ainda não revisada" em vez do badge atual "● SINCRONIZADA" — sinaliza pro usuário que aquela cifra pode ter erro e convida à correção.

---

## 6. Frente E — Banda / Setlist Compartilhado

**Schema:** `bands`, `band_members`, `setlists.bandId` (Seção 1).

**Arquivos novos:**

- `app/api/bands/route.ts` — `POST` cria banda (usuário vira `leaderUserId`), `GET` lista bandas do usuário (como líder ou membro).
- `app/api/bands/[id]/invite/route.ts` — `POST` gera um convite (token aleatório salvo em `band_members` com `status: 'invited'`, `invitedEmail`); envio de link é manual por enquanto (copiar/compartilhar), sem depender de e-mail transacional no MVP.
- `app/api/bands/join/[token]/route.ts` — `POST`, usuário autenticado aceita convite → `band_members.status = 'active'`, vincula `userId`.
- `app/api/bands/[id]/members/[memberId]/route.ts` — `PATCH` (líder define/edita o `instrument` de cada membro), `DELETE` (remove membro).

**Mudanças em rotas existentes:**

- `app/api/setlists/route.ts` (`POST`) — aceita `bandId` opcional; se vier, exige que o usuário seja `leaderUserId` daquela banda.
- `app/api/setlists/[id]/route.ts` — a função `loadOwnedSetlist` (linha 10-15 hoje) precisa virar `loadAccessibleSetlist`: acesso permitido se `setlist.userId === userId` (comportamento atual, preservado) **ou** (`setlist.bandId` não nulo **e** existe `band_members` ativo para aquele `bandId`/`userId`). Isso é o único ponto onde a lógica de permissão de setlist muda — o resto do arquivo (GET/PATCH/DELETE) segue igual, só troca a função de checagem.
- `app/setlists/[id]/SetlistDetailContent.tsx` — quando a setlist tem `bandId`, cada membro vê sua "trilha-guia": o player já suporta mute por stem (`WavePlayer`), então a única mudança é, ao carregar a página, pré-configurar `stemMuted` com tudo mudo exceto o stem cujo `instrument` bate com `band_members.instrument` daquele usuário naquela banda. Sem mudança na lógica de mute em si, só no estado inicial.

**Billing do plano Banda:** `subscriptions.userId` hoje é individual. Para o plano Banda, a assinatura fica associada a `bands.subscriptionId` (o líder paga, todos os `band_members` ativos herdam acesso Pro enquanto a banda tiver assinatura ativa). Checagem de `role === 'pro'` nas rotas precisa de uma segunda checagem: "é membro ativo de alguma banda com assinatura ativa" — encapsular isso numa função utilitária `hasProAccess(userId)` em `src/lib/access.ts`.

**[v1.2] O webhook Asaas não sabe o que é banda — precisa mudar junto:** `app/api/asaas/webhook/route.ts` hoje resolve `externalReference` no formato `user:ID` e seta `users.role = 'pro'` **do pagador**. Se nada mudar, numa assinatura de banda só o líder vira Pro. Ajuste: checkout do plano Banda emite `externalReference: 'band:ID'`; o webhook, ao receber `band:...`, atualiza o status da assinatura vinculada a `bands.subscriptionId` (e **não** mexe em `users.role` dos membros — o acesso deles vem via `hasProAccess`, que consulta a banda). Eventos de cancelamento seguem o mesmo caminho.

**[v1.2] Staleness do JWT — vale para Pro individual e para banda:** a sessão é JWT (`session: { strategy: 'jwt' }` em `auth.config.ts`); `role` entra no token no login e não muda até re-login. Isso já é um problema hoje (usuário paga via Asaas e continua "free" na sessão até relogar) e a materialização de acesso no JWT sugerida no item 2 acima herda o mesmo defeito: membro aceito na banda não ganha acesso até relogar. Mitigação: no callback `jwt` do `auth.ts` (runtime Node, pode tocar o banco), revalidar `role`/acesso-banda contra o banco quando o token tiver mais de N minutos (ex.: 5–10), gravando `accessCheckedAt` no token. Custo: uma query por usuário a cada N minutos, não por request. O middleware continua lendo só o claim (regra do edge preservada).

**[v1.1] Este refactor é maior do que parece e é o hotspot de regressão — tratar como passo isolado (ver Seção 9, passo 2b).** Hoje `requirePro(role)` é **síncrono** (`role === 'pro' || role === 'admin'`, ver `app/api/setlists/[id]/route.ts` linhas 6-8) e está espalhado em **~14 arquivos [v1.2: contagem reconferida — 4 rotas de setlist + 10 componentes/páginas, incluindo `SongPlayer.tsx` via prop `isPro`]**. Trocar por `hasProAccess(userId)` — que precisa consultar `band_members` + `subscriptions` — transforma toda checagem em **assíncrona com hit no banco por request**. Implicações:

1. **Não é só nas rotas de setlist.** Os call sites do lado servidor incluem no mínimo `app/api/setlists/route.ts`, `app/api/setlists/[id]/route.ts`, `app/api/setlists/[id]/songs/route.ts`, `app/api/setlists/[id]/songs/[songId]/route.ts`, além dos componentes/páginas que hoje gateiam por `role` (`AddToSetlist.tsx`, `SetlistsContent.tsx`, `SetlistDetailContent.tsx`, `song/[slug]/page.tsx`, `UserMenu.tsx`, `AdBanner.tsx`, `PlanosContent.tsx`, `Comments.tsx`). Mapear os 12 antes de começar.
2. **Custo por request:** para não pagar um JOIN em toda rota gated, considerar materializar o acesso efetivo no JWT/sessão do NextAuth (recalculado no login e na troca de assinatura), e usar `hasProAccess(userId)` como fonte da verdade só nas mutações sensíveis.
3. **Regra do edge (a mesma que o plano já respeita):** `hasProAccess` toca `src/db`, então **não pode** ser importada em `auth.config.ts` nem em nada que rode no middleware — só nos route handlers/server components. A checagem barata baseada em claim do JWT é o que fica no middleware.

---

## 7. Migração do Fluxo Existente (gate Pro / catálogo admin)

O admin CRUD (`app/admin/page.tsx`, `/api/songs` POST/PUT/DELETE, `/api/admin/upload-url`) **não é removido** — continua existindo para curadoria manual (ex.: domínio público, conteúdo institucional). O que muda:

- `songs.sourceType` distingue os dois fluxos; a home/catálogo pode, se quiser, filtrar ou destacar diferente conforme a origem.
- O botão "Seja Pro" e a página `/planos`, hoje desabilitados durante o beta (conforme roadmap registrado em memória), precisam de uma segunda opção de plano (Individual vs Banda) quando saírem do beta — não é bloqueante pra Fase 1.5, mas o schema de `bands`/`subscriptions` já deixa isso pronto pra quando acontecer.

---

## 8. Dependências Novas

| Pacote | Uso |
|---|---|
| `replicate` (SDK oficial) | Chamar o modelo Demucs hospedado via Replicate (Frente A) |
| Nenhum pacote de fila (Redis/BullMQ) | Replicate já é assíncrono via webhook — não precisa de fila própria nesta fase |
| `crypto` (nativo Node) | SHA-256 do arquivo (Frente B) — sem dependência nova |
| Cliente HTTP simples (`fetch` nativo) | Chamada à API da Music.ai (Frente C) — sem SDK dedicado necessário |

**[v1.1] Variáveis de ambiente novas (não há `.env.example` no repo — criar um e documentar):**

| Var | Uso |
|---|---|
| `REPLICATE_API_TOKEN` | Autenticação na API do Replicate (Frente A) |
| `REPLICATE_WEBHOOK_SECRET` | Validar assinatura do webhook de separação (segurança da Frente A) |
| `MUSICAI_API_KEY` | Autenticação na API da Music.ai (Frente C) |

Recomenda-se criar `.env.example` (sem valores) listando também as variáveis já existentes (`DATABASE_URL`, `R2_*`, `ADMIN_PASSWORD`, `ASAAS_*`, `NEXTAUTH_*`) para que o setup do pipeline seja reproduzível.

**[v1.1] Infraestrutura de teste — hoje inexistente.** O repositório não tem vitest/jest/playwright instalado. A Seção 10 aponta a migração `loadOwnedSetlist → loadAccessibleSetlist` como o maior risco de regressão de autorização e pede "teste explícito", mas não há onde colocá-lo. Decidir uma das duas rotas antes da Frente E: (a) adicionar um mínimo de teste (vitest) cobrindo ao menos o caso de autorização de setlist e a idempotência do webhook; ou (b) aceitar validação manual documentada. A opção (a) é fortemente recomendada porque os dois pontos são segurança.

---

## 9. Ordem de Execução Recomendada

A ordem segue dependência técnica direta, não a numeração do EVT:

1. **Schema completo** (Seção 1) — uma migration Drizzle só, todas as tabelas/colunas novas de uma vez (todas aditivas, não quebra nada em produção). **[v1.1]** O repo ainda não tem migrations versionadas geradas (a pasta `drizzle/` nem existe **[v1.2]**, fluxo por `db:push`); gerar uma migration nomeada com `db:generate` para versionar essa mudança em vez de só `push`. **[v1.2]** A migration inclui também o relaxamento de NOT NULL em `songs` e as tabelas `user_songs`/`processing_jobs.userId` (Seção 1) — decidir os bloqueantes da Seção 1 antes de gerar.
2. **Frente A + B juntas** (upload, separação, cache por hash) — são a mesma rota (`confirm`) e não fazem sentido isoladas. Este é o maior bloco de esforço. **[v1.1]** Inclui a segurança do webhook (assinatura + idempotência) e a deleção do mix original — não deixar para depois, são parte do fluxo mínimo correto.
2b. **[v1.1] Refactor `hasProAccess` (passo isolado, antes da Frente E)** — extrair `src/lib/access.ts`, mapear as 24 ocorrências de `requirePro`/`role === 'pro'|'admin'` nos 12 arquivos, converter para async e adicionar o teste de autorização de setlist (regressão). Isolar aqui, com commit próprio, porque toca auth de forma ampla e é o maior risco de regressão. A Frente E depende deste passo.
3. **Frente C** (Music.ai) — depende do webhook da Frente A já existir, mas é pequena (um adapter + uma chamada).
4. **Frente D** (cifra colaborativa) — independente das outras, pode ser feita em paralelo a A/B/C se houver mais de uma pessoa trabalhando; só depende do schema.
5. **Frente E** (banda) — a mais isolada tecnicamente (mexe em setlists, não em songs/stems), mas é o coração do diferencial de produto. Depende do passo 2b (`hasProAccess`). Não há dependência técnica forte entre E e A/B/C, só compartilham o schema inicial.

**Sugestão pragmática para time de uma pessoa:** 1 → 2 → 2b → 5 → 3 → 4. Isso coloca "upload funcional + banda" no ar o mais rápido possível (é o que valida a hipótese central do pivô com um grupo real, como o EVT recomenda na conclusão), deixando cifra automática e edição colaborativa — que são incrementos de qualidade, não bloqueadores de validação — para depois. O passo 2b entra antes da Frente E porque é pré-requisito técnico dela.

---

## 10. Riscos Técnicos Específicos desta Implementação

- **Webhook do Replicate em ambiente de desenvolvimento local:** Replicate precisa de uma URL pública para chamar de volta — em `localhost` isso não funciona. Usar um túnel (ex.: ngrok) durante desenvolvimento, ou testar o fluxo completo só em preview deployment da Vercel.
- **Vercel Hobby/Free tier e tempo de função:** mesmo o endpoint de webhook precisa responder rápido (só grava no banco e retorna 200); qualquer processamento pesado deve ficar do lado do Replicate, nunca dentro da function da Vercel.
- **Hash de arquivo calculado no browser:** arquivos grandes (WAV) podem demorar para hashear no client — considerar calcular em streaming (Web Crypto API `SubtleCrypto.digest` já suporta isso) para não travar a UI de upload.
- **Migração de `loadOwnedSetlist` para `loadAccessibleSetlist`:** é o ponto de maior risco de regressão de segurança (autorização) — precisa de teste explícito garantindo que um usuário fora da banda não acessa a setlist só porque sabe o ID.

**[v1.1] Riscos adicionais identificados na revisão de viabilidade:**

- **Webhook de separação sem autenticação (CRÍTICO):** endpoint público; sem validar a assinatura do Replicate, qualquer POST pode injetar stems falsos numa música. Mitigação: validar assinatura + secret em env; idempotência por `providerJobId`. Ver Frente A.
- **Abuso / estouro de custo no upload:** agora cada upload dispara GPU paga + Music.ai. A quota mensal por role não protege contra (a) requisitar N presigned URLs em paralelo e furar a contagem — emissão da URL e upload são desacoplados; nem (b) um bot subindo arquivos únicos de ruído que nunca batem no cache. Mitigação: um teto rígido de uploads por janela curta (rate limit), contar quota no `confirm` (não na emissão da URL), e não contabilizar cache hit nem job `failed`.
- **Retenção do mix original vs. direitos autorais:** o mix enviado pelo usuário precisa existir no R2 durante o pipeline, mas o EVT 5.1 exige não re-hospedar áudio original. Mitigação: deletar o objeto do mix original ao fim do webhook, mantendo só os stems (ver Frente A). Sem isso, a mitigação jurídica do pivô fica incompleta.
- **Duplicação de stems por reentrega de webhook:** `stems` não tem constraint de unicidade; um webhook reenviado insere stems repetidos. Mitigação: idempotência por `providerJobId` e inserção transacional.

**[v1.2] Riscos adicionais da segunda revisão:**

- **Envenenamento de catálogo via hash do client:** hash declarado pelo browser pode apontar para outra música (stems errados servidos a todo mundo que bater naquele `sourceHash`) ou furar quota. Mitigação: recomputar hash server-side + `HeadObject` no confirm (ver Frente A).
- **Stem público = distribuição:** URL pública permanente de stem de música comercial enfraquece o argumento "processadora, não distribuidora" do EVT 5.1. Mitigação: presigned GET autenticada para `user_upload` (ver Frente A).
- **Acesso preso no JWT:** pagamento confirmado ou entrada na banda só surte efeito no re-login. Mitigação: revalidação periódica no callback `jwt` (ver Frente E).
- **Webhook Asaas ativa só o pagador:** plano Banda sem ajuste no webhook deixa membros sem acesso. Mitigação: `externalReference 'band:ID'` (ver Frente E).
- **Trilha-guia degradada pelo 4-stem:** guitarra/teclado juntos em "other" no htdemucs padrão. Mitigação: avaliar `htdemucs_6s` antes de fixar o adapter (ver Frente A).
- **Falha na detecção de acorde após deleção do mix:** se o mix original for apagado antes de a Frente C concluir (ou numa retentativa após falha), não há mais fonte para reprocessar. Mitigação: deletar o mix só quando `separation` **e** `chord_detection` estiverem em estado final (`done` ou `failed` definitivo); em `failed` definitivo da cifra, deletar mesmo assim e deixar `chordsStatus` vazio (a cifra pode nascer da comunidade).
- **Visibilidade do upload no catálogo (decisão de produto pendente):** o cache por hash implica catálogo compartilhado, mas expor publicamente "quem subiu o quê" tem custo de privacidade e jurídico. Default sugerido para a Fase 1.5: música de `user_upload` **não** aparece no catálogo público (`published = false`); é acessível a quem tem `user_songs` ou banda. O compartilhamento do processamento (cache) continua funcionando por hash sem exposição pública.

---

*Este plano assume o schema e as rotas lidas em 2026-07-11. Se o código já tiver avançado desde então, reconferir `src/db/schema.ts` e `app/api/setlists/**` antes de iniciar a Frente E.*
