/**
 * Ponte com o app nativo (Capacitor, modo shell remoto).
 *
 * O app abre https://backingtrack.store/app num WebView e injeta a ponte
 * `window.Capacitor`. Estas funções só fazem algo dentro do app; no navegador
 * comum viram no-op — a mesma tela /app funciona nos dois lugares.
 *
 * Os plugins são importados sob demanda (import dinâmico) para não pesar no
 * bundle de quem usa o site no navegador. Só chamar no cliente (efeitos ou
 * handlers), nunca durante o render do servidor.
 */

/** User-Agent marcado em capacitor.config.ts (appendUserAgent). */
export const APP_UA_MARK = "BackingTrackApp/";

/** Esquema de URL do app — retorno do login feito no navegador do sistema. */
export const APP_URL_SCHEME = "store.backingtrack.app";

type CapGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function cap(): CapGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
}

/** true dentro do app Android/iOS. */
export function isNativeApp(): boolean {
  return cap()?.isNativePlatform?.() === true;
}

/** "android" | "ios" | "web". */
export function nativePlatform(): string {
  return cap()?.getPlatform?.() ?? "web";
}

/** Servidor: a requisição veio do WebView do app? (pelo UA marcado). */
export function isAppUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(APP_UA_MARK);
}

/** Toque leve de confirmação (play, mute, troca de aba). */
export async function haptic(style: "light" | "medium" = "light"): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch { /* plugin ausente numa build antiga do app: ignora */ }
}

/** Mantém a tela acesa (player, cifra, palco). Devolve a função que libera. */
export async function keepScreenOn(): Promise<() => void> {
  if (!isNativeApp()) return () => {};
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    await KeepAwake.keepAwake();
    return () => { void KeepAwake.allowSleep().catch(() => {}); };
  } catch {
    return () => {};
  }
}

/** Abre uma URL no navegador do sistema (Custom Tabs / SFSafariViewController). */
export async function openInSystemBrowser(url: string): Promise<void> {
  if (!isNativeApp()) { window.location.href = url; return; }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover", toolbarColor: "#0D0D0F" });
}

export async function closeSystemBrowser(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch { /* Android: já fechou sozinho ao voltar para o app */ }
}

// ── PKCE do login pelo navegador (ver createHandoffCode no servidor) ─────────

const VERIFIER_KEY = "bts_app_handoff_verifier";

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Gera e guarda o verifier; devolve o challenge (sha256 base64url). */
export async function startHandoff(): Promise<string> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = b64url(raw);
  try { localStorage.setItem(VERIFIER_KEY, verifier); } catch { /* sem storage: o login vai falhar com aviso */ }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** Lê e apaga o verifier (uso único). */
export function takeHandoffVerifier(): string | null {
  try {
    const v = localStorage.getItem(VERIFIER_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    return v;
  } catch {
    return null;
  }
}
