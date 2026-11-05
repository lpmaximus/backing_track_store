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
  // ─── Telemetria do piloto (PRD-BTS-001 v3.0 §4) ──────────────────────────
  "signup", // conta criada (servidor)
  "player_open", // abriu o player de uma música
  "practice_progress", // progresso de reprodução efetiva (meta: sid, effectiveS, interactions)
  "practice_qualified", // prática significativa — DERIVADO no servidor, 1x por sessão
  "separation_requested", // separação disparada (servidor)
  "separation_completed", // stems prontos (servidor, webhook)
  "take_started", // começou a gravar um take
  "take_saved", // take gravado e salvo (servidor)
] as const;

/**
 * Eventos que só o SERVIDOR grava. O client não pode mandá-los por
 * /api/activity — senão bastaria um POST para "virar" usuário ativado.
 */
export const SERVER_ONLY_EVENTS: ReadonlySet<string> = new Set([
  "signup",
  "practice_qualified",
  "separation_requested",
  "separation_completed",
  "take_saved",
]);

/** Regra da prática significativa (PRD-BTS-001 §3.1). Hipótese a revisar. */
export const PRACTICE_QUALIFY_SECONDS = 180;
export const PRACTICE_QUALIFY_INTERACTIONS = 1;

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
  signup: "Criou conta",
  player_open: "Abriu o player",
  practice_progress: "Progresso de prática",
  practice_qualified: "Prática significativa",
  separation_requested: "Pediu separação",
  separation_completed: "Separação pronta",
  take_started: "Começou a gravar",
  take_saved: "Salvou gravação",
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
