# Fechar as Frentes C, D e E — passo a passo

Guia para validar, configurar e publicar as três frentes recém-implementadas:
- **C** — cifra automática (Music.ai)
- **D** — correção colaborativa + moderação
- **E** — banda / setlist compartilhado

Tudo roda em `D:\dev\Backingtrack` (repo vivo). Faça na ordem.

---

## Passo 0 — Compilar e testar

```bash
cd D:\dev\Backingtrack
npm install
npm run build
npm test
```

Esperado: `build` sem erro de tipo e `npm test` com os testes de acesso passando.
Se o `build` acusar erro de tipo, anote a mensagem antes de seguir.

> **Banco:** NÃO precisa de nova migration. As tabelas que C/D/E usam
> (`processing_jobs`, `cifra_edit_history`, `cifra_reports`, `bands`,
> `band_members`, `setlists.band_id`) já foram criadas na migration da Fase 1.5.
> Se quiser confirmar, rode no Neon:
> `select to_regclass('band_members'), to_regclass('cifra_reports');`
> (as duas devem retornar o nome, não null).

---

## Passo 1 — Virar admin e Pro (para testar D e recursos Pro)

No **Neon → SQL Editor**, com o e-mail da sua conta do site:

```sql
-- admin (acessa /admin/moderacao e vê tudo)
update users set role = 'admin' where email = 'SEU_EMAIL_AQUI';
```

Depois **saia e entre de novo** no site para o token pegar o novo papel.
(Para testar como Pro comum, use `role = 'pro'`; para testar Free, `role = 'free'`.)

---

## Passo 2 — Configurar a Music.ai (Frente C)

A cifra automática só roda depois disto. Sem as chaves, o resto do app funciona
normal — a página só mostra "Cifra não disponível".

1. Crie conta em **music.ai** e pegue a chave em **conta → API keys** →
   preencha `MUSICAI_API_KEY` no `.env.local`.
2. No painel da Music.ai, crie um **workflow** que receba um áudio e produza
   **acordes** (chord/chord-recognition). Copie o **slug do workflow** →
   `MUSICAI_CHORDS_WORKFLOW` no `.env.local`.
3. Veja o **nome da saída** de acordes do workflow. Se não for `chords`,
   preencha `MUSICAI_CHORDS_OUTPUT` com o nome certo (senão pode deixar vazio).
4. Reinicie o `npm run dev` para carregar as novas variáveis.

> **Sobre o formato:** a detecção roda sobre o **stem de harmonia** (não sobre o
> mix original, que é apagado). O parser em `src/lib/chords/musicai.ts`
> (`parseChordPayload`) é tolerante a variações de nome de campo. Depois do 1º
> teste real, se a cifra não aparecer, veja o JSON que o workflow devolve e
> ajuste esse parser — do mesmo jeito que fizemos com o `STEM_MAP` do Replicate.

---

## Passo 3 — Testar a cifra automática (C) ponta a ponta

1. Garanta o `ngrok` no ar e o `PUBLIC_BASE_URL` apontando para ele (igual ao
   fluxo de upload que já funciona).
2. `npm run dev`, faça login, envie um áudio novo em `/upload`.
3. Quando o player abrir com os stems, a página começa a buscar a cifra
   sozinha: aparece **"Gerando cifra automática…"** e, quando o Music.ai termina,
   a cifra surge com o selo **"● AUTOMÁTICA · não revisada"**.
4. Se ficar preso em "gerando" por muito tempo, veja os logs do job na Music.ai
   e confira `MUSICAI_CHORDS_WORKFLOW`.

---

## Passo 4 — Testar correção + moderação (D)

1. **Corrigir** (como Pro/admin): na página da música, clique em
   **"✎ Sugerir correção"**, ajuste os trechos (rótulo, tempo, acordes) e salve.
   O selo muda para **"● SINCRONIZADA"** e a origem vira "comunidade".
2. **Reportar** (qualquer logado): botão **"⚑ Reportar erro"**.
3. **Moderar** (admin): abra **`/admin/moderacao`** — a denúncia aparece em
   "Denúncias abertas". Teste **Resolver/Descartar** e, em "Edições recentes",
   o botão **Reverter** (volta a cifra ao estado anterior).

---

## Passo 5 — Testar banda / setlist compartilhado (E)

Precisa de **duas contas** (ex.: seu login normal + uma conta de teste).

1. Como líder, abra **`/bandas`**, crie uma banda.
2. Expanda a banda → em "Convidar", escolha um instrumento e **Gerar link**.
   Copie a URL.
3. Na **segunda conta** (outro navegador/anônimo), abra o link do convite e
   aceite. Ela vira membro ativo.
4. Como líder, defina o **instrumento** de cada membro na lista.
5. Em **`/setlists`**, crie uma setlist e escolha **"Banda: <nome>"** no seletor.
6. Com a segunda conta (membro), abra `/setlists` — a setlist da banda aparece e
   é possível **abrir/ver** (mas só o líder edita).

> **Acesso Pro herdado:** se o líder tiver assinatura ativa quando cria a banda,
> os membros ativos herdam acesso Pro automaticamente (via `hasProAccess`).

---

## Passo 6 — Decisões de follow-up (não bloqueiam, mas valem)

- **Link "Bandas" no menu:** a página existe em `/bandas`, mas não está no
  cabeçalho. Adicionar um link em `app/components/SiteHeader.tsx` para descoberta.
- **Trilha-guia com auto-mute:** a base está pronta (`band_members.instrument`
  usa as mesmas chaves dos stems). Falta o player pré-mutar tudo menos o
  instrumento do membro ao abrir uma música de setlist de banda.
- **Checkout dedicado do plano Banda:** hoje a banda herda a assinatura ativa do
  líder. Um produto/preço próprio de banda no Asaas é um passo à parte.

---

## Passo 7 — Publicar na Vercel

1. Em **Vercel → Settings → Environment Variables**, adicione as novas:
   `MUSICAI_API_KEY`, `MUSICAI_CHORDS_WORKFLOW`, `MUSICAI_CHORDS_OUTPUT`
   (se usar) e, opcionalmente, `CRON_SECRET`.
2. Confirme que `PUBLIC_BASE_URL` em produção é o seu domínio (não o ngrok).
3. Deploy. Em produção o webhook do Replicate usa o domínio; o ngrok é só dev.
4. **(Opcional) Cron da cifra:** em dev, o próprio navegador avança a detecção
   pelo poll. Em produção, se quiser que a cifra finalize mesmo sem ninguém na
   página, crie um Vercel Cron chamando
   `GET /api/chords/advance/<songId>` com o header `x-cron-secret: <CRON_SECRET>`.
   (Sem isso, a cifra ainda finaliza quando alguém abre a música.)

---

## Checklist

- [ ] `npm install` + `npm run build` + `npm test` OK
- [ ] `role=admin` na sua conta (relogar)
- [ ] `MUSICAI_API_KEY` + `MUSICAI_CHORDS_WORKFLOW` preenchidos
- [ ] Upload novo gera cifra automática (selo "não revisada")
- [ ] Correção (Pro) → selo "SINCRONIZADA"; Reportar; `/admin/moderacao` reverte
- [ ] Banda: criar, convidar, aceitar em 2ª conta, setlist de banda visível ao membro
- [ ] Env novas na Vercel + `PUBLIC_BASE_URL` = domínio
- [ ] (opcional) link "Bandas" no menu; cron da cifra
