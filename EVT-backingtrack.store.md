# EVT — Estudo de Viabilidade Técnica
## backingtrack.store
**Data:** 2026-06-05 | **Versão:** 1.0 | **Status:** Rascunho

---

## 1. Visão do Produto

**backingtrack.store** é uma plataforma web para músicos amadores e profissionais que centraliza backing tracks (bases instrumentais) com cifras sincronizadas, permitindo que o músico toque junto, estude e se apresente com qualidade profissional diretamente no navegador.

### Proposta de Valor

| Para quem | Dor atual | O que entregamos |
|---|---|---|
| Músico amador | Backing tracks espalhadas no YouTube, cifras em outro site, BPM difícil de ajustar | Tudo em um lugar: base + cifra + controles |
| Músico profissional | Precisa de bases confiáveis para shows, ensaios e gravações | Biblioteca curada, download em alta qualidade |
| Professor de música | Precisa de material didático padronizado | Repertório com tonalidade e BPM catalogados |
| Produtor/Compositor | Quer monetizar backing tracks autorais | Marketplace para vender suas criações |

---

## 2. Definição do Produto Completo

### 2.1 Módulo Catálogo (Core)
- Listagem de músicas com busca full-text (título, artista)
- Filtro por gênero, tonalidade (key) e BPM
- Página individual de música com player + cifra
- Badges de gênero com cores por estilo musical
- Suporte multi-gênero: Rock, MPB, Bossa Nova, Samba, Jazz, Pop, Forró, Funk

### 2.2 Player de Áudio (Core)
- Player web com controles: play, pause, seek, volume
- Exibição de BPM e tonalidade da faixa
- Controle de velocidade (0.75x, 1x, 1.25x, 1.5x) via Web Audio API
- Transposição de tom em tempo real (pitch shift) — funcionalidade premium
- Loop de seção (A-B loop) — funcionalidade premium
- Modo "tela cheia" de cifra sincronizada com o áudio

### 2.3 Cifras (Core)
- Exibição formatada de cifra com acordes destacados
- Rolagem automática (auto-scroll) sincronizada com BPM
- Transposição de cifra acompanhando o pitch do áudio
- Editor de cifra no painel admin

### 2.4 Sistema de Usuários
- Cadastro/Login (email + senha, OAuth Google)
- Perfil do músico: instrumento, nível (iniciante/intermediário/avançado)
- Favoritos / lista "Meu Repertório"
- Histórico de músicas tocadas

### 2.5 Modelo Freemium
- **Plano Gratuito:** acesso a N músicas do catálogo (ex: 20), player básico, cifra
- **Plano Pro (assinatura mensal/anual):**
  - Catálogo completo ilimitado
  - Download em alta qualidade (WAV/MP3 320kbps)
  - Pitch shift e controle de velocidade avançado
  - Loop A-B
  - Modo offline (PWA com service worker)
  - Sem anúncios

### 2.6 Painel Admin (Back-office)
- CRUD de músicas (título, artista, gênero, key, BPM, áudio, cifra, slug)
- Upload de áudio diretamente para S3
- Gestão de usuários e assinaturas
- Métricas: músicas mais tocadas, usuários ativos, churn

### 2.7 Marketplace (Fase Futura)
- Produtores fazem upload de backing tracks autorais
- Precificação livre + comissão da plataforma (ex: 30%)
- Revisão e aprovação de conteúdo antes de publicar
- Painel de vendas para o produtor

---

## 3. Stack Tecnológica

### 3.1 Stack Atual (já em código)
| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js | 16.2.7 |
| Linguagem | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Estilo | Tailwind CSS | v4 |
| Dados | JSON local (songs.json) | — |
| Auth | Nenhuma ainda | — |
| Storage de áudio | Nenhum (campo vazio) | — |

### 3.2 Stack Necessária para o Produto Completo

**Backend / API:**
- Next.js API Routes (já existe) → evoluir para App Router com Server Actions
- Banco de dados: **PostgreSQL** via **Supabase** ou **Neon** (serverless, free tier generoso)
- ORM: **Prisma** ou **Drizzle ORM**

**Autenticação:**
- **NextAuth.js v5** (suporta OAuth Google, email/senha, sessão JWT)
- Alternativa: **Supabase Auth** (se usar Supabase para DB)

**Storage de Áudio:**
- **Cloudflare R2** (S3-compatible, sem egress fee — custo muito menor que AWS S3)
- CDN: **Cloudflare** (integrado ao R2, global)
- Upload direto do browser via presigned URL

**Pagamentos:**
- **Stripe** (Stripe Checkout + Stripe Billing para assinaturas recorrentes)
- Webhook para provisionar/revogar acesso Pro automaticamente

**Web Audio:**
- **Tone.js** (pitch shift, controle de tempo) ou API nativa Web Audio
- **WaveSurfer.js** (visualização de forma de onda, A-B loop)

**Deploy / Infra:**
- **Vercel** (Next.js nativo, serverless functions, CI/CD automático)
- Domínio: backingtrack.store (já possui)

---

## 4. Infraestrutura de Áudio

### 4.1 Pipeline de Áudio

```
[Admin Upload] → [Presigned URL R2] → [Cloudflare R2 Storage]
                                              ↓
                                    [Cloudflare CDN Global]
                                              ↓
                              [Player Web — streaming progressivo]
```

### 4.2 Formatos e Qualidade
| Tier | Formato | Bitrate | Uso |
|---|---|---|---|
| Gratuito | MP3 | 128kbps | Streaming no player |
| Pro — Streaming | MP3 | 320kbps | Streaming no player |
| Pro — Download | WAV | 44.1kHz/16bit | Download offline |

### 4.3 Estimativa de Custos R2 (Cloudflare)
- **Storage:** $0.015/GB/mês (ex: 1000 faixas × 10MB média = 10GB → ~$0.15/mês)
- **Operações:** $4.50/milhão de GETs — (custo praticamente zero no início)
- **Egress:** $0 (diferencial competitivo do R2 vs AWS S3)
- **Conclusão:** Custo de áudio desprezível até dezenas de milhares de plays/mês

---

## 5. Análise de Mercado e Concorrência

| Concorrente | Foco | Ponto Fraco | Nossa Oportunidade |
|---|---|---|---|
| YouTube | Backing tracks genéricas | Sem cifra, sem controles, ads | Experiência integrada |
| Cifra Club | Cifras e partituras | Sem backing track nativo | Junção de base + cifra |
| iReal Pro | Backing tracks geradas por IA | Pouco repertório BR, pago | Catálogo BR curado, freemium |
| Chordify | Detecção de acorde por áudio | Impreciso, sem backing track | Cifras humanas de qualidade |
| JamPlay / TrueFire | Aulas + backing tracks | Focado em guitarristas, $$ | Todos instrumentos, Brasil |

**Oportunidade clara:** não existe plataforma BR que una backing track de qualidade + cifra + player com controles avançados + modelo freemium acessível.

---

## 6. Riscos e Problemas Potenciais

### 6.1 Risco Legal / Direitos Autorais ⚠️ CRÍTICO

**Problema:** Backing tracks de músicas comerciais (Queen, Eagles, etc.) violam direitos autorais do fonograma e da composição, mesmo sendo "covers instrumentais". O ECAD e a BMI/ASCAP podem acionar a plataforma.

**Impactos:**
- Takedown de conteúdo
- Multas e processos judiciais
- Derrubada da plataforma

**Mitigações possíveis:**
1. Focar em **obras em domínio público** (composições com mais de 70 anos do falecimento do autor)
2. Produzir backing tracks **originais** próprias ou licenciadas (não derivadas do fonograma original)
3. **Marketplace de produtores independentes** que vendem suas criações autorais — transferindo responsabilidade + DMCA takedown policy
4. Licenciamento via **Creative Commons** ou parcerias com distribuidoras independentes
5. Parceria com ECAD para licenciamento coletivo (caro, mas legal)

**Recomendação:** o catálogo inicial deve ser 100% de obras em domínio público ou backing tracks autorais. Evitar qualquer faixa comercial identificável.

---

### 6.2 Risco de Custo de Infraestrutura de Áudio 🟡 MÉDIO

**Problema:** Crescimento rápido pode gerar custos inesperados de storage e bandwidth.

**Mitigações:**
- Usar Cloudflare R2 (zero egress cost)
- Limitar duração de sessão gratuita (ex: 1 min preview para free)
- Limitar downloads simultâneos
- Monitorar com alertas de custo

---

### 6.3 Risco Técnico: Performance do Player 🟡 MÉDIO

**Problema:** Pitch shift em tempo real via Web Audio API é computacionalmente intenso. Pode não funcionar bem em dispositivos mobile de baixo custo.

**Mitigações:**
- Implementar pitch shift server-side como alternativa (pre-render em tons diferentes)
- Fallback gracioso: desabilitar pitch shift em dispositivos lentos (detecção via User Agent + performance API)
- Testar em Android entry-level desde o início

---

### 6.4 Risco de Conteúdo: Qualidade das Cifras 🟡 MÉDIO

**Problema:** Cifras incorretas ou de má qualidade destroem a credibilidade da plataforma.

**Mitigações:**
- Revisão editorial rigorosa antes de publicar
- Sistema de report de erros pelos usuários
- Validação da cifra por músicos voluntários (programa beta)

---

### 6.5 Risco de Produto: Retenção e Conversão Freemium → Pro 🟡 MÉDIO

**Problema:** Converter usuários gratuitos em pagantes é o maior desafio do modelo freemium. Taxa de conversão típica é 2-5%.

**Mitigações:**
- Limite de músicas grátis bem calibrado (nem muito restritivo para testar, nem generoso a ponto de não converter)
- Features Pro claramente superiores (pitch shift, download, loop A-B)
- Trial de 7 dias grátis do Pro
- Preço acessível para mercado BR (ex: R$19.90/mês ou R$149/ano)

---

### 6.6 Risco de Autenticação e Segurança 🟢 BAIXO

**Problema:** Sem autenticação hoje. Implementar errado pode expor dados de usuários e pagamentos.

**Mitigações:**
- Usar NextAuth.js (solução consolidada, auditada)
- Nunca armazenar dados de cartão (tudo via Stripe)
- HTTPS obrigatório (Vercel garante)
- Rate limiting na API

---

### 6.7 Risco de Dependência de Plataforma 🟢 BAIXO

**Problema:** Dependência de Vercel, Stripe, Cloudflare, Supabase — cada um pode mudar preços ou termos.

**Mitigações:**
- Abstrair integrações com interfaces (ex: storage adapter, payment adapter)
- Evitar vendor lock-in de banco de dados (PostgreSQL é portável)
- Monitorar alternativas

---

## 7. Análise de Impactos

### 7.1 Impactos Técnicos na Migração do Estado Atual

| Mudança | Impacto | Esforço |
|---|---|---|
| JSON local → PostgreSQL | Alto — reestruturar toda a camada de dados | Alto |
| Sem auth → NextAuth | Alto — toda experiência muda com login | Médio |
| Sem storage → R2 | Médio — integração de upload + CDN URL | Médio |
| Sem pagamento → Stripe | Alto — billing, webhooks, controle de acesso | Alto |
| Player básico → avançado | Médio — Web Audio API, pitch, loop | Médio |
| Admin simples → back-office | Médio — mais campos, métricas | Baixo |

### 7.2 Impactos de Negócio

- **Positivo:** Receita recorrente previsível (MRR) via assinatura
- **Positivo:** Marketplace cria efeito de rede — mais produtores = mais conteúdo = mais usuários
- **Negativo:** Custo operacional de revisão de conteúdo (curadoria)
- **Negativo:** Suporte ao usuário cresce com base de pagantes
- **Risco:** Regulatório de direitos autorais pode exigir reestruturação do modelo de conteúdo

---

## 8. Plano de Fases Sugerido

### Fase 0 — Base Técnica (já iniciada)
- [x] Next.js + TypeScript + Tailwind
- [x] Catálogo de músicas (JSON)
- [x] Player básico + cifra
- [x] Admin CRUD básico
- [ ] Migrar JSON → PostgreSQL (Supabase/Neon)

### Fase 1 — MVP Monetizável (3-4 meses)
- [ ] Autenticação (NextAuth + Google OAuth)
- [ ] Storage de áudio (Cloudflare R2 + upload admin)
- [ ] Player de áudio real (streaming via R2/CDN)
- [ ] Stripe Checkout + assinatura Pro
- [ ] Limite freemium funcional
- [ ] Deploy produção (Vercel)

### Fase 2 — Produto Completo (2-3 meses)
- [ ] Pitch shift + controle de velocidade
- [ ] Loop A-B
- [ ] Favoritos / Meu Repertório
- [ ] Download de áudio (Pro)
- [ ] Auto-scroll de cifra
- [ ] PWA / modo offline

### Fase 3 — Marketplace (3-6 meses)
- [ ] Painel de produtor (upload, precificação)
- [ ] Fluxo de revisão e publicação
- [ ] Split de pagamento Stripe Connect
- [ ] Painel de analytics para produtor

---

## 9. Conclusão de Viabilidade

**Viabilidade Técnica: APROVADA ✅**

A stack escolhida (Next.js + Supabase + Cloudflare R2 + Stripe + Vercel) é madura, bem documentada e adequada para o produto. O custo de infraestrutura é desprezível no início e escala de forma previsível. Não há bloqueio técnico que impeça a execução.

**Ponto de Atenção Crítico: DIREITOS AUTORAIS ⚠️**

O maior risco do projeto não é técnico — é legal. A estratégia de conteúdo deve ser definida antes do lançamento público para evitar exposição da plataforma. Recomenda-se fortemente iniciar com catálogo 100% de domínio público ou backing tracks autorais licenciadas.

**Recomendação:** prosseguir para a Fase 1 com foco na base técnica (DB + Auth + Storage + Pagamento), em paralelo à definição da estratégia de conteúdo com suporte jurídico.

---

*Documento vivo — atualizar a cada decisão de produto ou mudança de escopo.*
