/**
 * Log de atividade do usuário logado (analytics de produto).
 *
 * O GA4 conta visitante anônimo; isto responde "quem entrou e o que fez".
 * Regras que valem para tudo que grava aqui:
 *  - só usuário autenticado (nunca anônimo);
 *  - só eventos da whitelist abaixo — o client não define nomes de evento;
 *  - nunca guarda IP, user-agent ou qualquer identificador de rastreamento;
 *  - falha de gravação NUNCA quebra a ação do usuário (best effort).
 */
import { db, userActivity, users } from "@/src/db";
import { eq, sql } from "drizzle-orm";

export const ACTIVITY_EVENTS = [
  "login", // entrou no sistema
  "play", // deu play numa música
  "mixer", // mexeu no volume/mute de algum stem
  "cifra", // abriu a tela de cifra
  "letra", // abriu a letra sincronizada
  "setlist_open", // abriu uma setlist
  "setlist_create", // criou uma setlist
  "stage_mode", // entrou no modo palco
  "upload", // enviou música própria
  "export", // exportou/baixou stems
] as const;

export type ActivityEvent = (typeof ACTIVITY_EVENTS)[number];

export const EVENT_LABELS: Record<ActivityEvent, string> = {
  login: "Entrou no sistema",
  play: "Tocou música",
  mixer: "Usou o mixer",
  cifra: "Abriu cifra",
  letra: "Abriu letra",
  setlist_open: "Abriu setlist",
  setlist_create: "Criou setlist",
  stage_mode: "Modo palco",
  upload: "Enviou música",
  export: "Exportou stems",
};

export function isActivityEvent(v: unknown): v is ActivityEvent {
  return typeof v === "string" && (ACTIVITY_EVENTS as readonly string[]).includes(v);
}

/**
 * Grava um evento e atualiza users.lastSeenAt. Best effort: engole o erro para
 * não derrubar a rota que chamou.
 */
export async function track(
  userId: number,
  event: ActivityEvent,
  opts?: { songId?: number | null; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await db.insert(userActivity).values({
      userId,
      event,
      songId: opts?.songId ?? null,
      meta: opts?.meta ?? null,
    });
    await db.update(users).set({ lastSeenAt: sql`now()` }).where(eq(users.id, userId));
  } catch (err) {
    console.error("[activity] falha ao gravar evento", event, err);
  }
}
