# Implementar o que foi gerado — Fase 1.5 (Frente A + B + passo 2b)

Guia prático para colocar no ar o que foi gerado: schema novo + upload do usuário com
separação de stems e cache por hash (Frentes A e B) + o refactor de acesso Pro
(`hasProAccess`, passo 2b). Faça na ordem. Tudo roda na sua máquina Windows
(o assistente não conseguiu aplicar por aqui: o sandbox não alcança o Neon e o
`node_modules` é cloud-only).

Tempo estimado: ~30–45 min (a maior parte é criar contas/pegar chaves).

> **O que mudou desde a primeira versão deste guia:** entrou o passo 2b (auth). Os
> Passos 2 e 2.5 abaixo agora incluem `npm install` e `npm test`. O resto (R2,
> Replicate, ngrok, teste do upload) segue igual.

---

## Passo 0 — Antes de tudo: backup do banco

O schema é 100% aditivo (não apaga nada), mas faça um ponto de restauração mesmo assim.

No Neon (console.neon.tech → seu projeto → **Branches**), crie um branch a partir de
`main` (ex.: `pre-fase15`). Se algo der errado, você volta pra ele. Leva 10 segundos.

---

## Passo 1 — Aplicar o schema no Neon

Abra o terminal na pasta `3-PRODUCAO` e rode:

```bash
npm run db:push
```

O drizzle-kit compara o `src/db/schema.ts` (já atualizado) com o banco e aplica as
mudanças. Quando ele listar o que vai fazer, confirme. Deve criar 5 tabelas
(`bands`, `band_members`, `processing_jobs`, `cifra_edit_history`, `cifra_reports`)
e adicionar colunas em `songs` e `setlists`.

**Alternativa manual:** se preferir revisar o SQL antes, rode o arquivo
`drizzle/0001_fase15_pivot.sql` direto no SQL Editor do Neon (é idempotente).

**Como conferir que deu certo** — no SQL Editor do Neon:

```sql
select column_name from information_schema.columns
where table_name = 'songs' and column_name = 'source_hash';
-- deve retornar 1 linha
```

---

## Passo 2 — Instalar dependências e conferir que compila

O passo 2b adicionou o `vitest` como devDependency, então rode o install primeiro:

```bash
npm install
npm run build
```

Se o `build` acusar erro de tipo, me mande a mensagem — os arquivos passaram na
checagem de sintaxe, mas o `tsc` completo (com os tipos do Drizzle/Next) só roda aqui
na sua máquina. Se o build passar, siga em frente.

## Passo 2.5 — Rodar os testes de acesso (passo 2b)

O refactor de autorização (`hasProAccess`) vem com teste automatizado da lógica de
segurança. Rode:

```bash
npm test
```

Esperado: **5 testes passando** em `src/lib/roles.test.ts` (matriz de decisão:
pro/admin concede; membro de banda com assinatura ativa concede; free sem banda nega).
Se algum falhar, não suba nada até resolver — é a regra que decide quem acessa recurso
Pro.

> **Sobre o passo 2b (nada a configurar):** as rotas de setlist passaram a usar
> `hasProAccess` no lugar do check de role antigo. O comportamento hoje é idêntico ao
> atual — o acesso via banda só passa a valer quando a Frente E ligar o billing (por
> ora nenhuma banda tem assinatura). Ou seja: nenhum passo de ambiente novo aqui, só
> garantir que `npm test` e `npm run build` passem.

---

## Passo 3 — Preencher as credenciais do Cloudflare R2

**Isto é pré-requisito: hoje os valores no `.env.local` são placeholders**
(`your_cloudflare_account_id` etc.), então o upload não sobe nada até você preencher.

No painel Cloudflare → **R2**:

1. `R2_ACCOUNT_ID` — em R2 → Overview (canto direito).
2. **Manage R2 API Tokens → Create API Token** (permissão *Object Read & Write*) →
   copie `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`.
3. `R2_BUCKET_NAME` — o nome do bucket (já está `audio`).
4. `R2_PUBLIC_URL` — ative em R2 → seu bucket → Settings → **Public Access** e copie
   a URL pública (`https://pub-xxxx.r2.dev`).

Preencha essas 5 variáveis no `.env.local`.

> **CORS do bucket:** como o browser faz `PUT` direto no R2, habilite CORS no bucket
> (R2 → bucket → Settings → CORS) permitindo `PUT` da origem do site
> (`http://localhost:3000` em dev e seu domínio em produção), com o header
> `content-type`.

---

## Passo 4 — Configurar o Replicate (separação de stems)

1. Crie conta em **replicate.com** e pegue o token em
   **Account → API tokens** → cole em `REPLICATE_API_TOKEN`.
2. Escolha um modelo **Demucs** (ex.: procure "demucs" no catálogo do Replicate).
   Na página do modelo, aba **API**, copie o hash da **version** → cole em
   `REPLICATE_DEMUCS_VERSION`.
3. Configure o webhook signing: **Account → Webhooks** → copie o **signing secret**
   (formato `whsec_...`) → cole em `REPLICATE_WEBHOOK_SECRET`.

> **Sobre o mapeamento de stems:** cada modelo Demucs devolve as faixas com nomes
> próprios (`vocals`, `drums`, `bass`, `other`…). O código já mapeia esses quatro em
> `src/lib/separation/replicate.ts` (constante `STEM_MAP`). Depois do primeiro teste,
> se algum stem não aparecer, confira os nomes que o modelo retornou e ajuste o mapa.

---

## Passo 5 — Expor o webhook em desenvolvimento (ngrok)

O Replicate precisa chamar seu servidor de volta quando termina a separação, e ele
**não alcança `localhost`**. Em dev, use um túnel:

1. Instale o ngrok (ngrok.com) e rode, com o app já no ar na porta 3000:

   ```bash
   ngrok http 3000
   ```

2. Copie a URL pública que ele mostra (`https://xxxx.ngrok-free.app`) e cole em
   `PUBLIC_BASE_URL` no `.env.local`.

Em produção (Vercel), `PUBLIC_BASE_URL` é o seu domínio (`https://backingtrack.store`).

---

## Passo 6 — Testar o upload ponta a ponta

1. Suba o app:

   ```bash
   npm run dev
   ```

2. Faça login (o upload exige estar logado).
3. Acesse **`http://localhost:3000/upload`**.
4. Escolha um arquivo de áudio curto (ex.: um MP3 de ~1 min pra testar rápido).
5. Acompanhe as fases: **Lendo → Enviando → Separando**. Quando terminar, você é
   redirecionado para a página da música com os stems.

**O que esperar nos bastidores:**
- O browser calcula o SHA-256 e chama `/api/upload` → recebe a presigned URL.
- Faz `PUT` do arquivo no R2 → chama `/api/upload/confirm` → cria a música + job e
  dispara o Replicate.
- O Replicate processa e chama `/api/webhooks/separation` → grava os stems, **apaga o
  mix original do R2** e marca como pronto.
- A tela faz poll em `/api/upload/status/[songId]` a cada 3s até ficar `ready`.

**Teste o cache (Frente B):** envie o **mesmo arquivo** de novo — deve ir direto pra
música, sem reprocessar (custo zero).

---

## Passo 7 — Deploy na Vercel (quando estiver ok em dev)

1. No projeto da Vercel → **Settings → Environment Variables**, adicione as MESMAS
   variáveis novas: `REPLICATE_API_TOKEN`, `REPLICATE_DEMUCS_VERSION`,
   `REPLICATE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (= seu domínio) e as `R2_*` reais.
2. Faça o deploy. Em produção não precisa de ngrok — o webhook usa o domínio.
3. Rode o `db:push` apontando para o banco de produção, se for outro.

---

## Resolução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Upload falha no `PUT` (erro CORS no console) | CORS do bucket R2 não liberado | Passo 3, bloco CORS |
| Fica preso em "Separando" pra sempre | Webhook não chegou | Confira `PUBLIC_BASE_URL` / ngrok ativo; veja logs do Replicate |
| Webhook responde 401 | `REPLICATE_WEBHOOK_SECRET` errado/vazio | Recopie o signing secret (Passo 4.3) |
| Stems não aparecem, mas job "done" | Nomes de saída do modelo ≠ `STEM_MAP` | Ajuste `STEM_MAP` em `replicate.ts` |
| "Servidor sem URL pública para webhook" | `PUBLIC_BASE_URL` vazio | Preencha no `.env.local` e reinicie o `npm run dev` |
| 429 "Limite mensal de uploads" | Quota free (5/mês) atingida | Esperado; teste com conta pro/admin ou ajuste em `src/lib/quota.ts` |

---

## Checklist rápido

- [ ] Branch de backup no Neon
- [ ] `npm run db:push` aplicado e conferido
- [ ] `npm install` (puxa o vitest do passo 2b)
- [ ] `npm run build` passa
- [ ] `npm test` — 5 testes de acesso passando
- [ ] `R2_*` reais no `.env.local` + CORS do bucket
- [ ] `REPLICATE_API_TOKEN` / `REPLICATE_DEMUCS_VERSION` / `REPLICATE_WEBHOOK_SECRET`
- [ ] `PUBLIC_BASE_URL` (ngrok em dev)
- [ ] Upload testado ponta a ponta
- [ ] Cache testado (mesmo arquivo 2x)
- [ ] Variáveis replicadas na Vercel (quando for pra produção)
