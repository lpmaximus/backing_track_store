"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import {
  APP_URL_SCHEME,
  closeSystemBrowser,
  isNativeApp,
  nativePlatform,
  takeHandoffVerifier,
} from "@/src/lib/native";

/**
 * Liga a casca nativa quando a área /app roda dentro do app Capacitor.
 * No navegador comum não faz nada.
 *
 *  - status bar escura e splash escondido quando a primeira tela pinta;
 *  - deep links: retorno do login Google (store.backingtrack.app://auth) e
 *    App/Universal Links https://backingtrack.store/... abertos pelo sistema.
 */
export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let removed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
      ]);

      try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (nativePlatform() === "android") await StatusBar.setBackgroundColor({ color: "#0D0D0F" });
      } catch { /* status bar indisponível (iPad em split view etc.) */ }
      void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});

      const sub = await App.addListener("appUrlOpen", ({ url }) => { void handleDeepLink(url); });
      if (removed) { void sub.remove(); return; }
      cleanups.push(() => void sub.remove());

      // Partida a frio pelo link (o app estava fechado): o evento acima já
      // passou. getLaunchUrl devolve a MESMA URL a cada carregamento de página,
      // então marca como tratada para não repetir depois do reload.
      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url && sessionStorage.getItem(HANDLED_KEY) !== launch.url) {
          sessionStorage.setItem(HANDLED_KEY, launch.url);
          void handleDeepLink(launch.url);
        }
      } catch { /* sem launch URL */ }
    })();

    return () => { removed = true; cleanups.forEach((fn) => fn()); };
  }, []);

  return null;
}

const HANDLED_KEY = "bts_app_launch_url";

async function handleDeepLink(url: string) {
  try { sessionStorage.setItem(HANDLED_KEY, url); } catch { /* ok */ }
  // 1) Volta do login feito no navegador do sistema.
  if (url.startsWith(`${APP_URL_SCHEME}://`)) {
    const u = new URL(url.replace(`${APP_URL_SCHEME}://`, "https://app.local/"));
    const code = u.searchParams.get("code");
    await closeSystemBrowser();
    if (!code) return;
    const verifier = takeHandoffVerifier();
    const base = window.location.pathname.startsWith("/en/") ? "/en/app" : "/app";
    if (!verifier) {
      window.location.href = `${base}/entrar?erro=handoff`;
      return;
    }
    const res = await signIn("app-handoff", { code, verifier, redirect: false });
    // Navegação "cheia" de propósito: recarrega a sessão em toda a árvore.
    window.location.href = res?.error ? `${base}/entrar?erro=handoff` : base;
    return;
  }

  // 2) App Link / Universal Link do próprio site: navega dentro do WebView.
  try {
    const u = new URL(url);
    if (u.hostname === "backingtrack.store" || u.hostname === "www.backingtrack.store") {
      window.location.href = `${u.pathname}${u.search}${u.hash}`;
    }
  } catch { /* URL malformada: ignora */ }
}
