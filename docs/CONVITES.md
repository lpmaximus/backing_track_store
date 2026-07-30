# Convites de teste — aba `/admin/convites`

Libera **Pro (individual)** ou **Pro Band (banda)** por um período (padrão 20 dias)
e com uma cota própria de separações, por e-mail, a partir de
`contato@l2techs.com`, com acompanhamento do funil.

---

## 1. Como ligar

### 1.1 Dependência

```bash
npm install          # instala nodemailer + @types/nodemailer (já em package.json)
```

### 1.2 Migração

```bash
npm run db:push
# ou, direto no SQL Editor do Neon (idempotente, nesta ordem):
#   drizzle/0009_invites.sql
#   drizzle/0010_invite_separations.sql
```

Cria `invites`, `invite_templates` e as colunas de trial em `users`
(`trial_plan`, `trial_started_at`, `trial_ends_at`, `trial_previous_role`,
`trial_source`, `trial_separations`).

### 1.3 Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Valor | Obrigatória |
|---|---|---|
| `SMTP_HOST` | `smtp.zoho.com` (ou `smtp.zoho.eu` / `.in` conforme a região da conta) | não (default `smtp.zoho.com`) |
| `SMTP_PORT` | `465` | não (default `465`) |
| `SMTP_USER` | `contato@l2techs.com` | **sim** |
| `SMTP_PASSWORD` | **senha de aplicativo** do Zoho, não a senha da conta | **sim** |
| `MAIL_FROM` | `contato@l2techs.com` | não (default = `SMTP_USER`) |
| `MAIL_FROM_NAME` | `Backing Track Store` | não |
| `MAIL_REPLY_TO` | `contato@l2techs.com` | não |
| `INVITE_SENDER_NAME` | `Luiz Paulo` | não |
| `CRON_SECRET` | já existente — usado pelo cron de expiração | **sim** |

> **Senha de aplicativo do Zoho:** Zoho Mail → Settings → Security →
> App Passwords → gerar uma para "backingtrack-smtp". Com 2FA ligada, a senha
> normal **não** funciona no SMTP.

### 1.4 Cron

`vercel.json` já registra `/api/jobs/trials` às 06:00 UTC. Ele rebaixa os trials
vencidos e avisa quem está a ~3 dias do fim. Redundante com a checagem feita no
login (`auth.ts`), de propósito.

---

## 2. DNS — o que faz o e-mail chegar na caixa de entrada

Sem isto, nada mais importa: o Gmail vai marcar como "não verificado" e o texto
mais bem escrito do mundo cai no spam.

Na **GoDaddy** (zona de `l2techs.com`):

| Tipo | Nome | Valor | Observação |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:zoho.com ~all` | **Um único registro SPF na zona.** Se ainda houver o SPF da Umbler, some os dois num só: `v=spf1 include:zoho.com include:<umbler> ~all` |
| TXT | `zmail._domainkey` | valor gerado pelo Zoho | Zoho Mail → Domains → DKIM → *Add selector* |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:contato@l2techs.com; pct=100` | começar em `p=none`, ler os relatórios ~2 semanas, depois subir para `p=quarantine` |
| MX | `@` | `mx.zoho.com` (10), `mx2.zoho.com` (20), `mx3.zoho.com` (50) | já configurado |

Verificação depois de propagar:

- envie um convite para uma conta **@gmail.com** sua;
- no Gmail: ⋮ → *Mostrar original* → precisa aparecer
  `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`;
- teste externo: enviar para o endereço gerado em `mail-tester.com` (nota ≥ 8/10).

> **Atenção:** dois registros SPF na mesma zona = SPF inválido = falha. Este é o
> erro mais comum quando se migra de provedor.

---

## 3. "Como não parecer phishing"

O problema é real: um e-mail frio, de remetente desconhecido, oferecendo acesso
pago de graça, com um link para clicar, tem **exatamente a mesma forma** de um
golpe. O que separa os dois não é design bonito — é um conjunto de sinais que a
pessoa (e o filtro) consegue verificar. Foram implementados assim:

### Sinais técnicos (invisíveis, mas decisivos)

1. **SPF + DKIM + DMARC** no domínio real — seção 2.
2. **Multipart texto + HTML.** Só-HTML é sinal barato de spam.
   `src/lib/inviteEmail.ts` sempre gera as duas versões.
3. **`List-Unsubscribe` + `List-Unsubscribe-Post`** no header, com página de
   descadastro em um clique e sem login (`/convite/<token>/sair`).
4. **Sem pixel de abertura.** Decisão consciente: pixel invisível é um dos
   sinais que mais aproximam um e-mail legítimo de um phishing aos olhos do
   destinatário técnico — e o Gmail/Apple pré-carregam ou bloqueiam a imagem,
   o que torna a métrica mentirosa de qualquer jeito. O funil começa no clique.
5. **Volume baixo.** Máximo de 20 destinatários por envio, na API e na UI.

### Sinais visíveis (o que a pessoa lê)

6. **Link honesto.** A URL aparece escrita por extenso, idêntica ao destino do
   botão, sempre em `https://backingtrack.store/convite/...`. **Nunca**
   encurtador (bit.ly e afins) e nunca redirect de terceiro — é o sinal nº 1 de
   golpe e destrói a confiança sozinho.
7. **Bloco de segurança explícito** no e-mail e na landing: "nunca pedimos
   senha, CPF, dados bancários ou cartão por e-mail".
8. **Sem anexo e sem formulário dentro do e-mail.** O login acontece na rota de
   sempre (`/entrar`), que a pessoa pode alcançar digitando o domínio à mão.
9. **Contexto pessoal:** nome de quem convida, motivo do envio e o endereço que
   recebeu. "Prezado cliente" levanta suspeita justificada.
10. **Sem urgência artificial.** Prazo real de validade (30 dias), nada de
    "clique em 24h ou perde". Pressa fabricada é a alavanca de todo golpe.
11. **Identificação completa no rodapé** e um Reply-To que responde de verdade.
12. **Reenvio mantém o mesmo token.** Link antigo que quebra é justamente o que
    faz um convite legítimo parecer golpe.

### Prática operacional (o que depende de você, não do código)

13. **Avise por outro canal.** Sempre que possível, um WhatsApp antes:
    *"te mandei um convite por e-mail, de contato@l2techs.com"*. Um segundo
    canal de confirmação resolve a desconfiança melhor que qualquer texto.
14. **Convide quem já te conhece primeiro.** Domínio novo disparando para
    desconhecidos queima reputação rápido e é difícil de recuperar.
15. **Aqueça o domínio.** Comece com 5–10 e-mails/dia na primeira semana e vá
    subindo. Não mande 200 no primeiro dia.
16. **Monitore as falhas.** A coluna de erro na tabela do admin mostra bounce
    de SMTP. Endereço que rejeita deve ser removido, não reenviado.

### LGPD

O envio é 1-a-1 para pessoas com relação prévia, com identificação do remetente,
finalidade clara e opt-out em um clique — a base é legítimo interesse
(art. 7º, IX). Descadastro solicitado marca o convite como `revoked` e a pessoa
não recebe mais nada. **Não** use esta ferramenta com lista comprada ou raspada.

---

## 4. Funil rastreado

| Estado | O que significa | Onde é marcado |
|---|---|---|
| `sent` | saiu do SMTP do Zoho sem erro | `createAndSendInvite` |
| `failed` | SMTP rejeitou — motivo visível na tabela | idem |
| `clicked` | abriu `/convite/<token>` | `markClicked`, na própria página |
| `accepted` | autenticou e clicou em "ativar" | `POST /api/invites/accept` |
| 1º uso | abriu a página de uma música já logado | `markFirstUse`, em `app/song/[slug]` |
| `expired` | passou de `expires_at` sem aceitar | `loadInvite` (preguiçoso) |
| `revoked` | cancelado no admin ou descadastro | `revokeInvite` / `unsubscribe` |

Abertura de e-mail **não** é rastreada — ver ponto 4 acima.

---

## 5. Como o trial funciona por dentro

O trial **não** cria um role novo. Ele promove `users.role` para `pro`/`proband`
e guarda a validade em `trial_ends_at` + o role de origem em
`trial_previous_role`.

**Por quê:** todo o código de permissão já existente (`isProRole`,
`permissions.ts`, `access.ts`, `quota.ts`) continua correto sem uma linha de
alteração. Um "role de trial" separado exigiria revisar cada checagem de acesso
do sistema, e qualquer caminho esquecido viraria acesso liberado indevidamente.

O preço é precisar rebaixar de volta — feito em dois lugares redundantes:

1. cron diário `/api/jobs/trials` → pega quem não loga;
2. `auth.ts`, no callback `jwt` → pega o caso do cron falhar.

Assinante pagante nunca é tocado: `startTrial` devolve `null` e não altera nada
se a pessoa já é `pro`/`proband`/`admin` sem `trial_plan`.

### 5.1 Cota de separações do convite

O campo **Separações liberadas** define quantas separações o convite dá no
**total do período de teste** — não por mês. Deixar em branco = limite normal do
plano (Pro 20 / Pro Band 40 por ciclo).

Como funciona:

* o número escolhido vai para `invites.trial_separations` e é copiado para
  `users.trial_separations` no aceite;
* enquanto `users.trial_separations` não é nulo **e** o trial está de pé,
  `quota.ts` troca a janela de contagem: em vez do ciclo mensal, conta tudo
  desde `trial_started_at` e usa esse número como teto. Sem reset no meio;
* no rebaixamento (`downgrade`) a coluna é zerada, então o ex-convidado volta
  ao limite normal do plano;
* um trial novo reinicia `trial_started_at`; estender um trial em curso
  preserva a data original (senão o consumo antigo comeria a cota nova);
* teto de segurança contra erro de digitação: `MAX_TRIAL_SEPARATIONS = 500`.

Na tela de envio a pessoa vê "Separações do seu teste · restam N até o fim do
período de teste" em vez do texto mensal — a API `/api/upload/quota` devolve
`trialPack: true` para isso.

---

## 6. Arquivos

```
src/lib/mailer.ts                    SMTP do Zoho (nodemailer)
src/lib/inviteEmail.ts               template texto + HTML, placeholders, bloco de segurança
src/lib/invites.ts                   regras de negócio, funil, listagem
src/lib/trials.ts                    início e expiração do trial
app/api/admin/invites/route.ts       GET lista+funil · POST envia
app/api/admin/invites/[id]/route.ts  PATCH resend | revoke
app/api/admin/invites/template/      GET/PUT texto padrão
app/api/invites/accept/route.ts      aceite (exige sessão)
app/api/jobs/trials/route.ts         cron de expiração
app/admin/convites/page.tsx          a aba
app/convite/[token]/page.tsx         landing do convite
app/convite/[token]/sair/page.tsx    descadastro em 1 clique
src/lib/quota.ts                     janela + limite (inclui o pacote do trial)
drizzle/0009_invites.sql             migração
drizzle/0010_invite_separations.sql  migração da cota de separações
```
