# Evolução do Conceito — Player Multitrack, Camadas e Gravação do Usuário
## backingtrack.store

**Data:** 2026-07-16 | **Status:** Ativo | **Base:** estende a `EVT-backingtrack.store.md` (v5)

Este documento registra as modificações de produto decididas e implementadas **depois** da EVT v5. Ele complementa a EVT — não a substitui. Onde há conflito, o mais recente aqui prevalece; o restante da EVT segue válido. A EVT deve receber um ponteiro para este arquivo, e a versão `.docx` oficial deve ser atualizada em seguida.

---

## 0. Resumo das modificações

| # | Tema | O que era na EVT v5 | O que passou a ser | Status |
|---|---|---|---|---|
| 1 | Player de áudio | WaveSurfer + controle por stem, pitch/velocidade | Player **multitrack estilo Moises** com motor Tone.js, onda por faixa, M/S por faixa, volume por faixa | Implementado |
| 2 | Visibilidade de música | Catálogo compartilhado abria todo upload processado | Compartilhamento **opt-in**, privado por padrão; dono edita/apaga | Implementado (falta aplicar migração) |
| 3 | Modelo de conteúdo | Música = base única | **Duas camadas**: base compartilhável + takes pessoais | Conceito fechado |
| 4 | Gravação do usuário | Não existia | **Gravar faixa própria** (voz/instrumento) por cima da base — novo diferencial | Planejado (v1) |

---

## 1. Player multitrack (reconstruído)

Substitui a descrição da EVT §2.2. O player da página da música (`app/song/[slug]/WavePlayer.tsx`) foi reescrito do modelo "WaveSurfer mestre + áudios ocultos" para um **multitrack real**, na linha do Moises.

### 1.1 Motor de áudio
- **Tone.js** é o motor: um `Tone.Player` por stem, todos no mesmo relógio → sincronia de amostra, sem correção de drift na unha.
- Cada faixa tem seu `Tone.Volume` (volume/mudo/solo reais por faixa).
- Cadeia master: faixas → volume master → `PitchShift` → saída.
- **Pitch shift** funciona de fato (antes era placeholder). **Velocidade** (0.5×–1.25×) preserva o tom, compensando o `playbackRate` no `PitchShift`.

### 1.2 Interface (por faixa)
- Botões **M (mudo)** e **S (solo)** — mutuamente exclusivos por faixa.
- **Volume** individual.
- **Onda** desenhada em canvas a partir dos peaks reais do áudio (o WaveSurfer deixou de ser usado neste componente).
- **Playhead** compartilhado atravessando as faixas, alinhado ao início real da onda; clique na onda salta para o ponto.

### 1.3 Transporte
- Play/pause (atalho espaço), relógio, **Volume Master**.
- Botões **« / »** para voltar/avançar 10 s.
- Rótulo de faixa: `harmony` é exibido como **Guitarra** (sobrescrita no player; a origem em `separation/replicate.ts` ainda grava "Harmonia").

### 1.4 Modos
- **Multitrack**: usuários Pro com stems separados.
- **Single (mix)**: usuário Free ou música sem stems — uma onda só, com play/seek/volume.

### 1.5 Pendências do player
- **Loop A-B** (previsto na EVT §2.2, ainda não implementado).
- **Modo Performance** (tela cheia, offline, pedal) — mantém prioridade da EVT §Fase 2.
- Ajuste fino do passo de skip (hoje 10 s) se necessário.

---

## 2. Gestão e visibilidade de músicas

Refina EVT §2.1/§2.5 e a regra do catálogo compartilhado.

### 2.1 O problema corrigido
Antes, `GET /api/songs/shared` expunha **automaticamente** todo upload processado, de qualquer usuário. Não havia como manter uma música privada.

### 2.2 O que passou a existir
- Coluna nova `songs.shared` (boolean, **default false** — privado por padrão). Migração em `drizzle/0002_add_shared.sql` (**pendente de aplicar no Neon**).
- Rota `PATCH /api/songs/[id]` (só dono/admin): edita `title`, `artist`, `genre`, `key`, `bpm` e alterna `shared`. O **slug/URL não muda** ao editar (não quebra links nem setlists).
- Rota `DELETE /api/songs/[id]` (só dono/admin): apaga a música **apenas se não estiver compartilhada** (senão retorna 409). Limpa os objetos do R2 (mix + stems + thumbnail) e o registro (cascade remove stems, itens de setlist e comentários).
- `GET /api/songs/shared` agora filtra `shared = true`.
- UI em `app/perfil/PerfilContent.tsx`: cada card de "Minhas músicas" tem **Compartilhar/Descompartilhar**, **Editar** (form inline) e **Apagar** (bloqueado enquanto compartilhada).

### 2.3 Efeito colateral aceito
Com privado por padrão, os uploads que hoje aparecem no catálogo compartilhado ficam privados até o dono reativar. É intencional — protege música própria.

---

## 3. Novo conceito: modelo de camadas (base × takes)

Adição conceitual que a EVT não tinha. Resolve a tensão entre "gravação é pessoal" e "compartilhar enfraquece se bloquearmos".

**Princípio:** uma música tem duas camadas independentes.

| Camada | Conteúdo | Natureza | Visibilidade |
|---|---|---|---|
| **Base** | stems, cifra, metadados | Derivada, colaborativa | Governada por `songs.shared` (catálogo entre Pros) |
| **Takes pessoais** | gravações do usuário (voz, instrumento) | Performance pessoal | Presa à conta; privada por padrão |

As camadas **nunca viajam juntas**: compartilhar a base não arrasta os takes. Quando outro usuário abre a mesma base, vê os stems + os **próprios** takes — nunca os de terceiros. É o modelo karaokê/Smule: todos dividem o instrumental, cada um guarda o próprio vocal. Consequência: **nunca** é preciso bloquear uma música do catálogo só porque alguém gravou por cima.

### 3.1 Três níveis de visibilidade do take
1. **Privada** (padrão) — só o dono.
2. **Da banda** — visível aos membros da banda (o app já tem Bandas). Ouro para ensaio à distância: cada um grava sua parte.
3. **Cover público** (opt-in, fase futura) — publica um take específico como cover/colab numa vitrine própria, com consentimento explícito e separado.

Gravação de voz é dado sensível — "privado por padrão" também é ganho de privacidade.

---

## 4. Novo diferencial: gravar faixas do usuário (overdub)

Item novo de produto. Reforça o §Diferencial competitivo da EVT.

**Ideia:** o usuário grava a própria faixa (canta no lugar do artista, ou toca um violão junto) por cima da base, e ela vira mais uma faixa no player multitrack — com volume/mudo/solo. Nenhum concorrente direto (Moises e afins) faz overdub; eles focam em separar e tocar.

### 4.1 Por que encaixa barato
O difícil (tocar N faixas em sincronia de amostra) **já está pronto** no motor Tone.js. Uma gravação é só mais um `Tone.Player` no mesmo relógio.

### 4.2 O ponto crítico — latência/sincronia
Todo navegador atrasa entre o som entrar no mic e ser gravado. Sem compensar, o take fica deslocado. Solução: **calibração de latência** (grava um clique de referência, mede o offset, compensa) + ajuste fino manual. Regras práticas: **fone de ouvido** (senão a base vaza no mic) e **contagem** antes de gravar.

### 4.3 Fluxo (documentado em diagrama)
Liberar microfone → preparo (fone + contagem) → calibrar latência (1ª vez) → gravar ouvindo a base → parar e compensar o offset → revisar → salvar privado → tocar junto.

### 4.4 Modelo de dados
Tabela nova `user_takes` (ligada a `songId` + `userId`), sempre pessoal, com `audioUrl` (R2), `name`, `offsetMs` (compensação) e `visibility` (private | band | public). Nunca em `stems`, nunca no catálogo compartilhado.

### 4.5 Fases sugeridas
- **v1:** grava uma faixa por vez, ouvindo a base, com volume e regravar; ajuste de offset manual.
- **v2:** contagem, calibração de latência automática, várias faixas.
- **v3:** exportar o mix final (usuário + base) num arquivo.

---

## 5. Diferencial competitivo — atualização

Acrescentar à lista da EVT §Diferencial:

4. **Overdub pessoal + camada de banda.** Gravar a própria voz/instrumento por cima da base separada, com os takes ficando privados por padrão e compartilháveis dentro da banda. Transforma a página de estudo em mini-gravação caseira e de ensaio coletivo — coisa que os apps de separação não fazem.

---

## 6. Roadmap atualizado (próximos passos)

**Imediato / desbloqueio**
1. Aplicar a migração `drizzle/0002_add_shared.sql` no Neon (`node _add_shared_column.mjs .env.local`) — sem isso, a home e as rotas quebram.
2. Rodar `npm run build` / `tsc` local (o sandbox lê arquivos truncados — verificação confiável só na máquina).

**Curto prazo (Fase 2 — retenção Pro)**
3. Loop A-B no player multitrack.
4. Modo Performance (tela cheia, offline/PWA, pedal).
5. Gravação do usuário — **v1** (uma faixa, offset manual, salvar privado, tocar junto) + tabela `user_takes`.

**Médio prazo**
6. Gravação — v2 (calibração automática de latência, contagem, múltiplas faixas).
7. Visibilidade de take "da banda" integrada às Bandas existentes.
8. Alinhar a origem do rótulo (`separation/replicate.ts`: "Harmonia" → "Guitarra") se a decisão for permanente.

**Futuro**
9. Gravação — v3 (export do mix final).
10. Cover público (vitrine de takes opt-in).
11. Marketplace (mantido da EVT §2.8).

---

## 7. Decisões em aberto

- **Formato/qualidade de gravação** (WebM/Opus vs WAV) e limite de duração.
- **Calibração já na v1** ou só ajuste manual de offset primeiro.
- **Onde fica o botão "Gravar faixa"** na tela da música.
- **Rótulo na origem** (renomear "Harmonia" para "Guitarra" no `STEM_MAP`, afetando novos uploads e o banco).
- **Cover público**: escopo, moderação e direitos (a gravação inclui a base de composição de terceiros — mesma família de risco da EVT §5.1).

---

*Documento vivo — atualizar a cada decisão. Complementa `EVT-backingtrack.store.md` (v5).*
