# App mobile (Android + iOS) — Capacitor

Decisão: **Capacitor em modo "shell remoto"**. O app nativo abre
`https://backingtrack.store/app` num WebView. As telas do app são rotas do
próprio Next.js (`app/[locale]/app/`), com o mesmo login, as mesmas APIs e o
mesmo motor de áudio do site. O app acrescenta a casca nativa: ícone, splash,
status bar, microfone, tela acesa, haptics e deep links.

Consequência prática: **tela nova ou correção sai pela Vercel**, sem passar
pela loja. Só mudança em plugin nativo (ou em `android/`/`ios/`) exige versão
nova na loja.

Protótipo de referência: canvas "backingtrack.store — App" (18 telas).

## O que existe (rodada 1)

| Tela do protótipo | Rota | Estado |
|---|---|---|
| Boas-vindas | `/app/boas-vindas` | pronta |
| Entrar / Criar conta | `/app/entrar` | pronta (Google, e-mail+senha, link por e-mail, esqueci a senha) |
| Início | `/app` | pronta (próximo ensaio/show, continuar praticando, mensagens) |
| Meu Estúdio + Catálogo | `/app/estudio` | pronta (minhas músicas, versões, catálogo, comunidade, "+") |
| Player multitrack + Cifra | `/app/song/[slug]` | pronta (abas Faixas/Cifra sobre um motor só, tom, velocidade, rolagem automática, A−/A+) |
| Enviar faixa, Gravar, Corrigir cifra, Setlists, Setlist, Palco, Banda, Convite QR, Conta, Planos, Mensagens | — | próxima rodada; hoje a barra inferior e os botões abrem as páginas do site |

## Rodar no Android (Windows)

Pré-requisito: Android Studio (traz o JDK e o SDK).

```bash
npm install
npx cap sync            # copia config/plugins para android/ e ios/
npx cap open android    # abre no Android Studio → Run ▶ no celular/emulador
```

**Importante:** o app abre a área `/app` DO SITE EM PRODUÇÃO. Antes de testar
o app, faça o deploy deste código na Vercel — senão o app abre um 404.

Testar contra o servidor local (celular na mesma rede Wi‑Fi):

```bash
npm run dev -- -H 0.0.0.0
CAP_SERVER_URL=http://SEU-IP-LOCAL:3000/app npx cap sync android
```
(No PowerShell: `$env:CAP_SERVER_URL="http://192.168.0.10:3000/app"; npx cap sync android`.)
Depois volte a rodar `npx cap sync` sem a variável antes de gerar a versão da loja.

## Rodar no iOS

Só num Mac com Xcode: `npx cap sync ios && npx cap open ios`, escolher o Team
em *Signing & Capabilities* e rodar. Dependências via Swift Package Manager
(sem CocoaPods).

## Login com Google dentro do app

O Google bloqueia OAuth dentro de WebView. Fluxo implementado:

1. App gera um segredo (`verifier`) e manda só o hash (`challenge`) para
   `/app/handoff`, aberto no **navegador do sistema** (Custom Tabs / Safari).
2. A pessoa entra com Google lá; a página mostra "Voltar para o app".
3. O toque abre `store.backingtrack.app://auth?code=…` → o app troca
   `code + verifier` por sessão (provider `app-handoff` em `auth.ts`).

O código vale 5 min e só funciona com o verifier que nunca saiu do app (PKCE).
Não precisa mudar nada no Google Cloud Console.

## App Links / Universal Links (opcional, recomendado)

Faz o link de acesso por e-mail e convites abrirem direto no app.

- **Android:** na Vercel, `ANDROID_SHA256_CERT_FINGERPRINTS` = SHA‑256 da chave
  de upload e da Play App Signing (Play Console → Integridade do app), separadas
  por vírgula. Servido em `/.well-known/assetlinks.json`.
- **iOS:** na Vercel, `APPLE_TEAM_ID`; no Xcode, capability *Associated Domains*
  com `applinks:backingtrack.store`. Servido em
  `/.well-known/apple-app-site-association`.

## Antes de enviar às lojas

- **Apple — Sign in with Apple (diretriz 4.8):** app com login Google precisa
  oferecer também "Entrar com Apple" no iOS.
- **Pagamentos (Apple 3.1.1 / Google Play):** assinatura digital comprada
  dentro do app precisa usar a cobrança da loja. Decidir: IAP/Play Billing, ou
  esconder checkout e preços no app (modelo "leitor"). Hoje o app leva a
  `/planos` do site.
- Política de privacidade e formulário de segurança de dados (Play) /
  rótulos de privacidade (App Store): microfone e conta.
- Versão: `android/app/build.gradle` (`versionCode`/`versionName`) e
  *Marketing Version* no Xcode.
- Chave de assinatura Android (`.jks`) **fora do git** (já no `.gitignore`).

## Ícones e splash

Fontes em `assets/` (marca BRD‑001). Para regenerar:
`npx @capacitor/assets generate --iconBackgroundColor "#0D0D0F" --splashBackgroundColor "#0D0D0F"`.
