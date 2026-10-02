/**
 * Evento customizado no GA4 (client-side). Best effort: sem gtag carregado
 * (bloqueador, consentimento) simplesmente não envia — nunca lança.
 *
 * Eventos do plano de funil (out/2026):
 *   search_no_results   { search_term }
 *   upload_cta_click    { from: "home_hero" | "catalog_empty" | ... }
 *   demo_mixer_open     { from }
 *   sign_up             { method: "email" | "magic_link" }
 *   login               { method: "google" | "email" | "magic_link" }
 *   inapp_browser_blocked { app }
 */
export function gaEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (typeof gtag === "function") gtag("event", name, params);
  } catch {
    /* analytics nunca derruba a página */
  }
}
