# EVT — Estudo de Viabilidade Técnica
## backingtrack.store
**Data:** 2026-07-11 | **Versão:** 5.0 | **Status:** Ativo — substitui integralmente a v4

*Documento oficial: `2-DOCS/EVT-ESTUDO VIABILIDADE TECNICA/EVT-001.v5.docx`. Este markdown é espelho de leitura rápida.*

> **Modificações posteriores (2026-07-16):** player multitrack, compartilhamento opt-in, modelo de camadas (base × takes) e gravação do usuário estão documentados em [`CONCEITO-FASE-2-PLAYER-CAMADAS-TAKES.md`](./CONCEITO-FASE-2-PLAYER-CAMADAS-TAKES.md). Este EVT segue válido; ler os dois em conjunto.

---

## Nota de Revisão — Por que esta versão existe

A v4 descrevia um modelo de **catálogo próprio de backing tracks** (produzidas pelo fundador via iReal Pro) combinado com cifra sincronizada. Esse modelo foi lançado, colocado em modo de manutenção e **suspenso por risco de direitos autorais**: mesmo com backing tracks "originais", hospedar e distribuir faixas associadas a composições comerciais expõe a plataforma a reivindicação de ECAD/editoras.

Esta versão registra o pivô de produto decidido em 2026-07: o site deixa de hospedar/distribuir áudio de terceiros e passa a operar como **ferramenta de processamento sobre o áudio que o próprio usuário envia** — modelo tecnicamente idêntico ao do Moises (app brasileiro de separação de stems), que opera nessa categoria há anos sem litígio. A responsabilidade sobre a origem do áudio passa a ser do usuário; a plataforma é processadora, não distribuidora de conteúdo.

Tudo que foi construído na Fase 0/1 (Next.js, auth, player WaveSurfer, engine de cifra por timecode, setlist, Modo Performance) é reaproveitável quase sem alteração. O que muda é a origem do áudio e a camada de colaboração.

---

## 1. Visão do Produto

**backingtrack.store** é uma plataforma web onde músicos e bandas fazem upload de qualquer faixa, recebem a separação automática em stems (bateria, baixo, harmonia, vocal) e uma cifra sincronizada — corrigível pela comunidade — para praticar, ensaiar em grupo e se apresentar ao vivo.

### Proposta de Valor

| Para quem | Dor atual | O que entregamos |
|---|---|---|
| Músico amador | Quer isolar um instrumento pra estudar, mas backing track pronta não existe pra toda música | Upload da própria faixa → stems + cifra sincronizada |
| **Banda / ministério de louvor** | Repertório muda toda semana, cada integrante treina sozinho sem saber como fica junto, cifra chega errada ou sem padrão | Setlist compartilhado, stem por instrumento, cifra corrigida pela própria comunidade, distribuição automática pra banda toda |
| Músico em show | Ferramentas de prática não servem pro palco | Modo Performance: tela cheia, fonte grande, offline, sem anúncio, avanço por pedal bluetooth |

### Diferencial competitivo

Não é "separar melhor que o Moises" — isso é jogo perdido contra US$50M de capital e time proprietário.

1. **Foco em banda/grupo, não músico solo.** Setlist semanal compartilhado, cada integrante recebe sua trilha-guia, líder distribui o repertório. Nicho grande e mal atendido no Brasil: ministérios de louvor.
2. **Cifra validada por comunidade, não só detecção automática.** Corrigir uma vez beneficia todo mundo que tocar a mesma música depois — efeito de rede que o Moises não tem.
3. **Modo Performance real de palco.** O Moises é ferramenta de prática no celular, não de show.

---

## 2. Definição do Produto

### 2.1 Upload e Processamento (Core)
- Upload de áudio próprio do usuário
- Separação automática em stems via modelo self-hosted
- Detecção de BPM e tom
- Cache por música única (hash/fingerprint) — reaproveita processamento entre usuários

### 2.2 Player de Áudio (Core — já construído na Fase 1)
- WaveSurfer.js + controle por stem, pitch shift, velocidade (Tone.js)
- Loop A-B
- Modo Performance: tela cheia, offline, sem anúncio

### 2.3 Cifra Colaborativa (novo)
- Rascunho automático via detecção de acorde/chave (Music.ai, só na 1ª vez por música)
- Edição aberta à comunidade Pro, correção salva no catálogo compartilhado
- Histórico de versão

### 2.4 Banda / Grupo (novo)
- Líder cria/nomeia setlist, compartilha com integrantes
- Cada integrante vê sua trilha-guia + cifra sincronizada
- Setlist vira Modo Performance no dia do evento

### 2.5 Sistema de Usuários
NextAuth v5 (já implementado), perfil de instrumento/papel na banda, setlist, histórico.

### 2.6 Modelo Freemium

**Free:** limite de separações/mês (benchmark Moises = 5), prévia de exportação limitada (1 min), cifra só leitura, ads leve.

**Pro Individual — R$24,90/mês:** separações ilimitadas/teto alto, cifra editável, pitch/loop/setlist pessoal, Modo Performance offline.

**Pro Banda — R$59,90/mês (lançamento):** tudo do individual + setlist compartilhado + login por integrante + painel do líder.

### 2.7 Painel Admin
Métricas de uso, custo de processamento, moderação de cifra.

### 2.8 Marketplace (Fase Futura, mantido da v4)
Produtores/arranjadores vendem cifra revisada ou repertório curado.

---

## 3. Stack Tecnológica

### 3.1 Stack Atual (reaproveitada sem alteração)
Next.js 16 + TypeScript, React 19 + Tailwind v4, WaveSurfer.js + Tone.js, PostgreSQL/Neon + Drizzle, NextAuth v5, Cloudflare R2, **Asaas** (não Stripe), Vercel.

### 3.2 Separação de Stems — decisão

**Demucs (open-source, licença permissiva Meta/FAIR) via GPU serverless pay-per-uso (padrão Replicate).** ~R$0,15/música.

| Rota | Custo por música (~4 min) |
|---|---|
| Demucs self-hosted via GPU serverless (escolhido) | R$0,13-0,15 |
| Music.ai (API turnkey completa) | R$1,02-2,04 |
| LALAL.AI (por stem) | R$12,24 |

### 3.3 Detecção de Acorde/Chave — compra seletiva

**Music.ai, módulo específico (US$0,04/min, ~R$0,82/música), só na 1ª vez que a música entra no catálogo — nunca por play.** Resolve a maior queixa registrada contra o próprio Moises (acorde/tempo errado); custo se dilui conforme mais gente toca a mesma música.

### 3.4 Avaliado e descartado

- **Modelo próprio (tipo Moises-Light):** existe reimplementação MIT não-oficial (`crlandsc/moises-light`) sem pesos treinados. Gargalo não é GPU (barato), é dado — MoisesDB e MUSDB18-HQ são licenciados só para uso não-comercial. Reavaliar só em escala.
- **MiroFish (simulação narrativa multi-agente, referência de outro projeto — iPYSY):** sem encaixe. Resolve "explicar confiança de previsão probabilística", problema que não temos.

---

## 4. Análise de Mercado e Concorrência

### 4.1 Moises

Brasileiro (fundador Geraldo Ramos) — "somos BR" não é diferencial. 70M usuários (dez/2025). US$50,2M captados (seed US$8,6M 2022 + Series A US$40M, monashees/Connect Ventures/Samsung Next). 181 funcionários (mai/2026).

Tecnologia proprietária (não usa Demucs/Spleeter), treinada com musicólogos contratados. Publicaram "Moises-Light" (paper WASPAA 2025). Braço B2B Music.AI licencia a tecnologia via API.

**Preço real no Brasil (confirmado via conta paga própria, jul/2026):**

| Plano | Preço | Observação |
|---|---|---|
| Free | R$0 | 5 separações/mês, export limitado a 1 min |
| Premium mensal | **R$9,90/mês** | o que a maioria realmente paga |
| Premium anual | R$5,82/mês equiv. | só compromisso anual |
| Pro | R$29,16/mês (anual) | produção musical (VST/mixagem/masterização) |

Separação ilimitada mesmo no tier barato — confirma custo baixo até pra eles. Geração por IA é o que é racionado (200 créditos/mês = 100 min, mesmo pago) — categoria de custo mais alta.

**Fraquezas:** qualidade inconsistente, tempo/acorde errado, app "flaky", suporte de cancelamento ruim.

**Margem:** receita 2025 estimada (Latka, não-auditado) ~US$16,1M com 146-181 funcionários — provavelmente não lucrativo no líquido, modo crescimento VC. Margem bruta provavelmente saudável (~85%, mesma ordem da nossa).

### 4.2 Outros concorrentes

| Concorrente | Ponto forte | Ponto fraco | Oportunidade |
|---|---|---|---|
| LALAL.AI | Qualidade | Cobra por stem, caro | Inviável como back-end |
| Music.ai (B2B) | API modular | Não é produto final | Usado seletivamente |
| Cifra Club | Marca, comunidade | Sem stem nativo | Combinação cifra+stem é rara |

---

## 5. Riscos

### 5.1 Direitos Autorais — CRÍTICO → BAIXO/MÉDIO
Upload próprio transfere responsabilidade ao usuário — mesma categoria do Moises, backingtrackbrasil.com (14 anos), Cifra Club. Resíduo: metadados de música identificável. Mitigação: termos de uso, takedown ágil, sem re-hospedar áudio original.

### 5.2 Qualidade Percebida vs. Concorrente — MÉDIO (novo)
Demucs open-source < modelo proprietário Moises. Mitigação: diferencial é de produto (banda/cifra/palco), não de qualidade de separação.

### 5.3 Dependência de GPU Serverless — MÉDIO (novo)
Mitigação: adapter abstrato, monitorar 2-3 provedores alternativos.

### 5.4 Custo de Infraestrutura — BAIXO (mantido, com número real: R$0,15-0,97/música)

### 5.5 Conversão Freemium→Pro — MÉDIO (mantido; mitigado pelo plano banda converter N pessoas de uma vez)

### 5.6 Autenticação/Segurança/Dependência de Plataforma — BAIXO (mantidos sem alteração)

---

## 6. Modelagem Financeira

*(Seção nova. Câmbio: R$5,10/USD, jul/2026)*

### 6.1 Custo por música processada
| Componente | Custo | Frequência |
|---|---|---|
| Separação (Demucs self-hosted) | R$0,15 | Toda música nova |
| Acorde/chave (Music.ai) | R$0,82 | 1ª vez por música no catálogo |
| Storage R2 | ~R$0,0003/mês | Desprezível |

### 6.2 Custo por usuário/mês
| Perfil | Uso | Custo |
|---|---|---|
| Free | 3 músicas/mês | R$0,45 |
| Pro Individual | ~18-20/30 | R$2,70-3,00 |
| Pro Banda | ~20 únicas/mês (repertório compartilhado) | R$3,00 |

### 6.3 Preço, custo e margem (com taxa Asaas R$0,49+1,99%)
| Plano | Preço | Custo total | Margem |
|---|---|---|---|
| Pro Individual | R$24,90 | ~R$3,74 | ~85% (R$21,16) |
| Pro Banda (lançamento) | R$59,90 | ~R$4,09 | ~86% (~R$55,81) |
| Pro Banda (reserva) | R$29,90-39,90 | ~R$4,09 | ~86% |

### 6.4 Preço da banda vs. Moises
R$59,90 empata com 6 pessoas pagando Moises Premium mensal (6×R$9,90=R$59,40) — mais barato pra bandas maiores. Ministério de louvor típico: 6-12 pessoas → pitch já funciona no lançamento. **Decisão: manter R$59,90 no lançamento**, R$29,90-39,90 como alavanca não anunciada.

### 6.5 Breakeven
Custo fixo ~R$350-400/mês (Vercel/Neon/domínio/R2 em escala). Breakeven ≈ **19 assinantes Pro Individual**.

### 6.6 Tier free (ads) — estimativa frágil
RPM nicho BR R$18-35/mil pageviews → ~R$0,20-0,50/usuário free/mês, perto do custo de R$0,45. Free tende a zero a zero — é aquisição, não lucro. Validar com dado real.

### 6.7 Comparação estrutural
| | Moises | backingtrack.store |
|---|---|---|
| Tecnologia | Proprietária, ensemble | Demucs open-source |
| Custo/música | US$0,005-0,02 (atacado) | ~R$0,15 (varejo) |
| Capital em IA | US$50M+ | R$0 |
| Equipe | 181 pessoas | 1 fundador |
| Margem líquida | provavelmente fina/negativa (modo VC) | positiva desde ~19 assinantes |

O Moises precisa de dezenas de milhões de usuários pra discutir lucro líquido (folha de 181 pessoas + retorno de capital). Nosso breakeven é de dezenas de assinantes — jogo certo é nicho lucrativo rápido, não escala de frente.

---

## 7. Análise de Impactos

| Mudança | Impacto | Esforço |
|---|---|---|
| Catálogo próprio → upload do usuário | Alto (risco jurídico + fluxo de conteúdo) | Médio (player/auth/DB reaproveitados) |
| Cifra do admin → colaborativa | Médio | Médio |
| Setlist individual → banda | Médio | Médio |

---

## 8. Plano de Fases

**Fase 0 — Fundação ✅ COMPLETA** — Neon+Drizzle, R2 presigned, admin CRUD.

**Fase 1 — MVP ✅ maior parte concluída** — dark UI, WaveSurfer, cifra sincronizada, NextAuth, gate Pro mockado. Pendente: redirecionar gate/conteúdo pro fluxo de upload.

**Fase 1.5 — Pivô técnico (nova, prioridade imediata):**
1. Fila de upload + separação (adapter de GPU serverless)
2. Cache de catálogo por hash de áudio
3. Integração Music.ai pra rascunho de cifra
4. UI de edição colaborativa + moderação
5. Setlist compartilhado + convite de banda

**Fase 2 — Retenção Pro** (mantida) — Loop A-B, Modo Performance, PWA offline, diagramas de acorde, métricas.

**Fase 3 — Escala** (mantida) — Marketplace, Stripe/Asaas Connect, app mobile.

---

## 9. Conclusão de Viabilidade

**Técnica: APROVADA** — stack 90% reaproveitável, camada nova é simples comparada ao que já existe.

**Financeira: APROVADA** — margem bruta ~85%, breakeven ~19 assinantes. Sustentável em escala pequena, ao contrário do concorrente principal.

**Direitos autorais: CRÍTICO → BAIXO/MÉDIO** — pivô resolve o problema que suspendeu a v4.

**Novo ponto de atenção: diferenciação de produto, não de tecnologia** — não dá pra competir em qualidade de separação com quem tem US$50M e 181 pessoas. A viabilidade depende de executar bem o nicho (banda/ministério, cifra comunitária, palco).

**Recomendação:** prosseguir para Fase 1.5 com prioridade máxima. Validar conceito de banda com grupo real antes de investir em polimento de UI adicional.

---

*Documento vivo — atualizar a cada decisão de produto ou mudança de escopo. Substitui EVT-001.v4 integralmente. Versão docx oficial: `2-DOCS/EVT-ESTUDO VIABILIDADE TECNICA/EVT-001.v5.docx`.*
