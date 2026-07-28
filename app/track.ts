"use client";

/**
 * Helper de client para registrar atividade do usuário logado.
 *
 * Dispara e esquece: nunca bloqueia a UI, nunca lança erro, e usuário anônimo
 * simplesmente não gera linha (o servidor responde 204). Use nos pontos em que
 * o usuário DEMONSTRA uso do produto — play, mixer, cifra, setlist, palco.
 *
 *   import { track } from "@/app/track";
 *   track("play", { songId: song.id });
 */
type Event =
  | "login"
  | "play"
  | "mixer"
  | "cifra"
  | "letra"
  | "setlist_open"
  | "setlist_create"
  | "stage_mode"
  | "upload"
  | "export";

// Evita repetir o mesmo evento na mesma sessão de navegação (o servidor também
// deduplica, mas isso poupa requisição).
const sent = new Set<string>();

export function track(event: Event, opts?: { songId?: number; meta?: Record<string, unknown>; once?: boolean }): void {
  if (typeof window === "undefined") return;

  const key = `${event}:${opts?.songId ?? ""}`;
  if (opts?.once !== false) {
    if (sent.has(key)) return;
    sent.add(key);
    // libera de novo depois de 10 min, alinhado com o dedupe do servidor
    setTimeout(() => sent.delete(key), 10 * 60_000);
  }

  try {
    void fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, songId: opts?.songId, meta: opts?.meta }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencioso por design */
  }
}
