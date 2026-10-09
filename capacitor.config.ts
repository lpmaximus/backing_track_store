import type { CapacitorConfig } from "@capacitor/cli";

/**
 * App nativo do backingtrack.store (Android + iOS) — ADR: Capacitor em modo
 * "shell remoto".
 *
 * O WebView abre direto a área /app do site em produção. Login, APIs, cookies
 * e o motor de áudio são os mesmos do site; o que o app acrescenta é a casca
 * nativa (ícone, splash, status bar, microfone, tela acesa no palco, haptics,
 * deep links). Tela nova ou correção sai pela Vercel, sem passar pela loja —
 * só mudança em plugin nativo exige versão nova na loja.
 *
 * Para testar contra o servidor local: CAP_SERVER_URL=http://192.168.0.10:3000/app npx cap sync
 * (o celular precisa estar na mesma rede; `cleartext` liga sozinho para http).
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://backingtrack.store/app";
const isHttp = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "store.backingtrack.app",
  appName: "BackingTrack",
  // Só a página de "sem conexão" mora dentro do app; o resto vem do site.
  webDir: "mobile-shell",
  // O servidor reconhece o app por aqui (UA) — ver src/lib/native.ts.
  appendUserAgent: "BackingTrackApp/1.0",
  backgroundColor: "#0D0D0F",
  server: {
    url: serverUrl,
    cleartext: isHttp,
    // Navegação para estes hosts continua DENTRO do app; qualquer outro link
    // abre no navegador do sistema.
    allowNavigation: ["backingtrack.store", "www.backingtrack.store"],
    // Sem internet na abertura: mostra a tela local em vez do erro do WebView.
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false, // o site chama SplashScreen.hide() quando pinta
      backgroundColor: "#0D0D0F",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0D0D0F",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
