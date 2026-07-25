/**
 * Autorização dos ensaios/shows (Fase S1 / ADR-BTS-005).
 *
 * Fonte única de "quem é esse usuário dentro deste setlist/evento". Espelha o
 * padrão de `resolveAccess` que já existia solto em /api/setlists/:id/comments,
 * mas centralizado porque agora seis rotas dependem da mesma resposta.
 *
 * Regras que este módulo carrega (ADR-BTS-005 §5):
 *   - D11: só o LÍDER cria/edita/apaga evento, pauta e escalação. Não existe
 *     coordenador delegado no MVP.
 *   - D3:  presença é do próprio integrante — ninguém responde pelo outro.
 *   - D4:  prontidão é do próprio escalado — nem o líder muda.
 *   - D12: a grade de prontidão é legível por toda a banda.
 *
 * Setlist PESSOAL (bandId null) tem só um ator: o dono, que é tratado como
 * líder — é assim que a "Sessão de estudo" do Pro solo (D6) reusa este módulo.
 *
 * Toca o banco (Neon) — NÃO importar em componentes "use client" nem no
 * middleware/edge.
 */
import { db, setlists, setlistEvents, bandMembers, bands } from "@/src/db";
import { and, eq } from "drizzle-orm";

/** Papel do usuário dentro de um setlist. */
export type SetlistRole =
  | { kind: "notfound" }
  | { kind: "forbidden" }
  /** Dono do setlist pessoal, ou líder da banda dona dele. Pode tudo. */
  | { kind: "leader"; setlistId: number; bandId: number | null; instrument: string | null }
  /** Membro ativo da banda. Lê tudo, escreve só o que é dele. */
  | { kind: "member"; setlistId: number; bandId: number; instrument: string | null };

export type LeaderOrMember = Extract<SetlistRole, { kind: "leader" | "member" }>;

/** Verdadeiro se o papel resolvido pode criar/editar evento, pauta e escalação (D11). */
export function canManageEvent(role: SetlistRole): role is Extract<SetlistRole, { kind: "leader" }> {
  return role.kind === "leader";
}

/**
 * Resolve o papel do usuário no setlist.
 *
 * Ordem de checagem (barata → cara): dono do setlist → líder da banda →
 * membro ativo. Só consulta band_members quando o setlist é de banda.
 */
export async function resolveSetlistRole(setlistId: number, userId: number): Promise<SetlistRole> {
  if (!Number.isFinite(setlistId) || !Number.isFinite(userId)) return { kind: "forbidden" };

  const [s] = await db
    .select({ id: setlists.id, userId: setlists.userId, bandId: setlists.bandId })
    .from(setlists)
    .where(eq(setlists.id, setlistId))
    .limit(1);
  if (!s) return { kind: "notfound" };

  // Instrumento do usuário nesta banda. O líder também é músico: sem isto o
  // deep link do player não pré-mutaria a trilha dele.
  const instrumentOf = async (bandId: number) => {
    const [m] = await db
      .select({ instrument: bandMembers.instrument })
      .from(bandMembers)
      .where(
        and(
          eq(bandMembers.bandId, bandId),
          eq(bandMembers.userId, userId),
          eq(bandMembers.status, "active"),
        ),
      )
      .limit(1);
    return m ?? null;
  };

  // Dono do setlist (pessoal ou de banda) age como líder.
  if (s.userId === userId) {
    const m = s.bandId != null ? await instrumentOf(s.bandId) : null;
    return { kind: "leader", setlistId: s.id, bandId: s.bandId, instrument: m?.instrument ?? null };
  }

  if (s.bandId == null) return { kind: "forbidden" };

  const [band] = await db
    .select({ leaderUserId: bands.leaderUserId })
    .from(bands)
    .where(eq(bands.id, s.bandId))
    .limit(1);
  if (band?.leaderUserId === userId) {
    const m = await instrumentOf(s.bandId);
    return { kind: "leader", setlistId: s.id, bandId: s.bandId, instrument: m?.instrument ?? null };
  }

  const m = await instrumentOf(s.bandId);
  if (m) {
    return { kind: "member", setlistId: s.id, bandId: s.bandId, instrument: m.instrument };
  }

  return { kind: "forbidden" };
}

/**
 * Resolve o papel a partir do ID do EVENTO (as rotas de presença, pauta,
 * escalação e prontidão só recebem o eventId na URL).
 */
export async function resolveEventRole(
  eventId: number,
  userId: number,
): Promise<{ role: SetlistRole; setlistId: number | null }> {
  if (!Number.isFinite(eventId)) return { role: { kind: "forbidden" }, setlistId: null };

  const [ev] = await db
    .select({ setlistId: setlistEvents.setlistId })
    .from(setlistEvents)
    .where(eq(setlistEvents.id, eventId))
    .limit(1);
  if (!ev) return { role: { kind: "notfound" }, setlistId: null };

  const role = await resolveSetlistRole(ev.setlistId, userId);
  return { role, setlistId: ev.setlistId };
}

/** Tipos de evento aceitos (D15: rótulos da interface vêm do front). */
export const EVENT_TYPES = ["rehearsal", "show", "practice"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Respostas de presença (D3). */
export const ATTENDANCE_STATUSES = ["yes", "no", "maybe"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Status de item da pauta/ata. */
export const ITEM_STATUSES = ["planned", "done", "repeat"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** Semáforo de prontidão (D4). Três níveis, um toque para mudar. */
export const READINESS_LEVELS = ["todo", "studying", "ready"] as const;
export type Readiness = (typeof READINESS_LEVELS)[number];
