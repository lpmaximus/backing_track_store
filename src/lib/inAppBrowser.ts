/**
 * Detecta navegador embutido de app (Instagram, Facebook, TikTok, Line…).
 *
 * O Google recusa login OAuth nesses navegadores ("Erro 403:
 * disallowed_useragent"), no iPhone e no Android. Quem chega por link do
 * Instagram/TikTok — inclusive da campanha de tráfego do TikTok — toca em
 * "Continuar com Google" e recebe uma tela de erro. Detectar permite trocar o
 * botão por uma instrução e manter o e-mail como porta de entrada.
 *
 * WhatsApp fica de fora de propósito: no iOS ele abre links no
 * SFSafariViewController e no Android em Custom Tabs, onde o Google funciona.
 */
export type InAppBrowser = "instagram" | "facebook" | "tiktok" | "line" | "snapchat" | "linkedin" | "twitter" | null;

export function detectInAppBrowser(ua: string): InAppBrowser {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return "facebook";
  if (/musical_ly|TikTok|BytedanceWebview|Bytedance/i.test(ua)) return "tiktok";
  if (/\bLine\//i.test(ua)) return "line";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/LinkedInApp/i.test(ua)) return "linkedin";
  if (/Twitter/i.test(ua)) return "twitter";
  return null;
}

/** Android: intent que abre a mesma URL no Chrome. iOS não tem equivalente confiável. */
export function chromeIntentUrl(href: string): string | null {
  try {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
  } catch {
    return null;
  }
}
