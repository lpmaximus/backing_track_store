/**
 * Fila de jobs de CIFRA e LETRA — a ÚNICA implementação de submit / poll / retry.
 *
 * Antes a lógica vivia copiada em cinco lugares (webhook, advance de cifra,
 * advance de letra, finalize, backfill) e cada cópia tratava falha de um jeito:
 * o webhook submetia a cifra uma vez e, se desse erro, o job morria; o advance
 * marcava `failed` em qualquer erro; só a letra tinha fila de submissão. Com
 * volume (centenas de separações) isso vira música sem cifra/letra em escala.
 *
 * Ciclo de vida de um job (processing_jobs.status):
 *   pending  (sem providerJobId)  → na fila, esperando submissão
 *   running  (sem providerJobId)  → "reservado" por alguém que está submetendo
 *   running  (com providerJobId)  → predição rodando no Replicate (polling)
 *   done | failed                 → terminal (failed pode voltar p/ pending:
 *                                   ver retry.ts)
 *
 * Concorrência: o poll da página, o cron e o webhook podem rodar ao mesmo tempo.
 * `submitJob` RESERVA o job com um UPDATE condicional (pending → running) antes
 * de chamar o provider; só quem ganhou a reserva submete. Reserva abandonada
 * (função que morreu no meio) volta p/ a fila em `runQueue`.
 *
 * Rate limit: o Replicate (saldo < US$5) aceita ~6 criações/min, burst 1. Um 429
 * NÃO é falha — o job fica `pending` e a próxima rodada tenta.
 */
import { db, songs, stems, processingJobs } from "@/src/db";
import { and, asc, eq, inArray, isNull, isNotNull, lt } from "drizzle-orm";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { pickChordAudio } from "@/src/lib/chords/source";
import { purgeSourceMix } from "@/src/lib/retention";
import { isThrottled } from "@/src/lib/replicateSubmit";
import type { ChordPollResult, ChordMeta } from "@/src/lib/chords/types";
import type { LyricsPollResult } from "@/src/lib/lyrics/types";
import { decideFailure, isRelaxed, PERM_PREFIX } from "./retry";

export type Job = typeof processingJobs.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type JobStage = "chord_detection" | "lyrics_detection";
export type Outcome = "running" | "done" | "retry" | "failed";
export type SubmitOutcome = "submitted" | "throttled" | "retry" | "failed" | "skipped";

const STAGES: JobStage[] = ["chord_detection", "lyrics_detection"];

/** Reserva sem providerJobId há mais que isto = função morreu no meio do submit. */
const STALE_CLAIM_MS = 10 * 60 * 1000;
/** Predição sem resposta há mais que isto = tratada como falha transitória. */
const STUCK_RUNNING_MS = 45 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Campos de bpm/tom/batidas a gravar, quando o detector devolveu algum. */
export function metaPatch(m: ChordMeta | undefined) {
  return {
    ...(m?.bpm ? { bpm: m.bpm } : {}),
    ...(m?.key ? { key: m.key } : {}),
    ...(m?.beats?.length ? { beats: m.beats } : {}),
  };
}

// ─── Falha / retry ──────────────────────────────────────────────────────────

/** Aplica a política de retry.ts: volta p/ a fila (pending) ou marca `failed`. */
export async function failOrRetry(job: Pick<Job, "id" | "errorMessage">, error: string): Promise<"retry" | "failed"> {
  const d = decideFailure(job.errorMessage, error);
  if (d.action === "retry") {
    await db
      .update(processingJobs)
      .set({ status: "pending", providerJobId: null, errorMessage: d.message, completedAt: null, createdAt: new Date() })
      .where(eq(processingJobs.id, job.id));
    return "retry";
  }
  await db
    .update(processingJobs)
    .set({ status: "failed", errorMessage: d.message, completedAt: new Date() })
    .where(eq(processingJobs.id, job.id));
  return "failed";
}

// ─── Aplicar resultado do poll ──────────────────────────────────────────────

/** Grava o resultado de um poll de CIFRA. Compartilhado por advance e finalize. */
export async function applyChordResult(job: Job, song: Song, result: ChordPollResult): Promise<Outcome> {
  if (result.status === "running") return "running";

  if (result.status === "failed") {
    // BPM/tom/batidas saem da mesma execução e não dependem da cifra ter saído.
    const patch = metaPatch(result.meta);
    if (Object.keys(patch).length > 0) await db.update(songs).set(patch).where(eq(songs.id, song.id));
    const r = await failOrRetry(job, result.error);
    // Só libera o mix quando o job é terminal; em retry o mix ainda é necessário.
    if (r === "failed") await purgeSourceMix(song.id);
    return r;
  }

  const setChords = !(song.chords && song.chords.length > 0);
  const patch = metaPatch(result.meta);
  if (setChords || Object.keys(patch).length > 0) {
    await db
      .update(songs)
      .set({
        ...(setChords ? { chords: result.sections, chordsSource: "auto" as const, chordsStatus: "draft" as const } : {}),
        ...patch,
      })
      .where(eq(songs.id, song.id));
  }
  await db.update(processingJobs).set({ status: "done", completedAt: new Date() }).where(eq(processingJobs.id, job.id));
  await purgeSourceMix(song.id); // retenção adiada (EVT 5.1): a cifra já leu o mix
  return "done";
}

/** Grava o resultado de um poll de LETRA. */
export async function applyLyricsResult(job: Job, song: Song, result: LyricsPollResult): Promise<Outcome> {
  if (result.status === "running") return "running";
  if (result.status === "failed") return failOrRetry(job, result.error);

  if (!(song.lyrics && song.lyrics.length > 0)) {
    await db
      .update(songs)
      .set({ lyrics: result.lines, lyricsSource: "auto", lyricsStatus: "draft" })
      .where(eq(songs.id, song.id));
  }
  await db.update(processingJobs).set({ status: "done", completedAt: new Date() }).where(eq(processingJobs.id, job.id));
  return "done";
}

/** Consulta o provider e aplica o resultado. Erro de rede no poll NÃO derruba o job. */
export async function pollJob(job: Job, song: Song): Promise<Outcome> {
  if (!job.providerJobId) return "running";
  try {
    if (job.stage === "chord_detection") {
      return await applyChordResult(job, song, await getChordProvider().poll(job.providerJobId));
    }
    return await applyLyricsResult(job, song, await getLyricsProvider().poll(job.providerJobId));
  } catch (err) {
    console.error(`[queue] poll job#${job.id} (${job.stage})`, err);
    return "running"; // próxima passada tenta; STUCK_RUNNING_MS cobre o caso crônico
  }
}

// ─── Submissão ──────────────────────────────────────────────────────────────

/** Devolve a reserva à fila sem contar tentativa (ex.: 429, provider off). */
async function releaseToQueue(jobId: number) {
  await db
    .update(processingJobs)
    .set({ status: "pending", providerJobId: null, createdAt: new Date() })
    .where(eq(processingJobs.id, jobId));
}

/**
 * Submete UM job `pending` ao provider. Reserva atômica → só um chamador
 * submete. Nunca lança.
 */
export async function submitJob(job: Job): Promise<SubmitOutcome> {
  try {
    const claimed = await db
      .update(processingJobs)
      .set({ status: "running", createdAt: new Date() })
      .where(and(eq(processingJobs.id, job.id), eq(processingJobs.status, "pending"), isNull(processingJobs.providerJobId)))
      .returning({ id: processingJobs.id });
    if (claimed.length === 0) return "skipped"; // outro chamador pegou

    const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
    if (!song) {
      await db
        .update(processingJobs)
        .set({ status: "failed", errorMessage: `${PERM_PREFIX} Música não encontrada`, completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      return "failed";
    }
    const songStems = await db.select().from(stems).where(eq(stems.songId, job.songId));

    let providerJobId: string;
    try {
      if (job.stage === "chord_detection") {
        const provider = getChordProvider();
        if (!provider.isConfigured()) { await releaseToQueue(job.id); return "skipped"; }
        const source = pickChordAudio(song.audioUrl, songStems);
        if (!source) {
          await db
            .update(processingJobs)
            .set({ status: "failed", errorMessage: `${PERM_PREFIX} Sem áudio elegível para detectar a cifra`, completedAt: new Date() })
            .where(eq(processingJobs.id, job.id));
          await purgeSourceMix(song.id);
          return "failed";
        }
        ({ providerJobId } = await provider.submit(source.url));
      } else {
        const provider = getLyricsProvider();
        if (!provider.isConfigured()) { await releaseToQueue(job.id); return "skipped"; }
        if (song.lyrics && song.lyrics.length > 0) {
          // Já tem letra (comunidade/outro job): nada a transcrever.
          await db.update(processingJobs).set({ status: "done", completedAt: new Date() }).where(eq(processingJobs.id, job.id));
          return "skipped";
        }
        const vocal = songStems.find((s) => s.instrument === "vocal" && s.audioUrl);
        if (!vocal) {
          await db
            .update(processingJobs)
            .set({ status: "failed", errorMessage: `${PERM_PREFIX} Sem stem de vocal (faixa instrumental)`, completedAt: new Date() })
            .where(eq(processingJobs.id, job.id));
          return "failed";
        }
        ({ providerJobId } = await provider.submit(vocal.audioUrl, { fast: true, relaxed: isRelaxed(job.errorMessage) }));
      }
    } catch (err) {
      if (isThrottled(err)) { await releaseToQueue(job.id); return "throttled"; }
      console.error(`[queue] submit job#${job.id} (${job.stage})`, err);
      return failOrRetry(job, String(err).slice(0, 400));
    }

    // Mantém errorMessage: ele carrega o contador de tentativas.
    await db
      .update(processingJobs)
      .set({ status: "running", providerJobId, createdAt: new Date(), completedAt: null })
      .where(eq(processingJobs.id, job.id));
    return "submitted";
  } catch (err) {
    console.error(`[queue] submitJob job#${job.id}`, err);
    return "skipped";
  }
}

/** Cria o job `pending` (sem submeter). Reaproveita nada: jobs `failed` retentáveis são apagados antes. */
export async function enqueueJob(songId: number, stage: JobStage, providerName: string): Promise<Job> {
  await db
    .delete(processingJobs)
    .where(and(eq(processingJobs.songId, songId), eq(processingJobs.stage, stage), eq(processingJobs.status, "failed")));
  const [job] = await db
    .insert(processingJobs)
    .values({ songId, provider: providerName, stage, status: "pending" })
    .returning();
  return job;
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export interface QueueSummary {
  released: number;
  timedOut: number;
  checked: number;
  chordsDone: number;
  lyricsDone: number;
  retried: number;
  failed: number;
  stillRunning: number;
  submitted: number;
  throttled: boolean;
  pendingLeft: number;
}

/**
 * Uma passada completa da fila: devolve reservas abandonadas, fecha o que está
 * rodando, e submete o que está esperando — até acabar o orçamento de tempo ou
 * o Replicate pedir calma (429). Chamado pelo cron /api/jobs/finalize.
 */
export async function runQueue(opts: { budgetMs?: number; pollBatch?: number; submitBatch?: number } = {}): Promise<QueueSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const pollBatch = opts.pollBatch ?? 40;
  const submitBatch = opts.submitBatch ?? 20;
  const left = () => budget - (Date.now() - started);

  const s: QueueSummary = {
    released: 0, timedOut: 0, checked: 0, chordsDone: 0, lyricsDone: 0,
    retried: 0, failed: 0, stillRunning: 0, submitted: 0, throttled: false, pendingLeft: 0,
  };

  // 1. Reservas abandonadas (running sem providerJobId) voltam p/ a fila.
  const staleClaims = await db
    .update(processingJobs)
    .set({ status: "pending", createdAt: new Date() })
    .where(
      and(
        eq(processingJobs.status, "running"),
        isNull(processingJobs.providerJobId),
        inArray(processingJobs.stage, STAGES),
        lt(processingJobs.createdAt, new Date(Date.now() - STALE_CLAIM_MS)),
      ),
    )
    .returning({ id: processingJobs.id });
  s.released = staleClaims.length;

  // 2. Predições que nunca responderam: falha transitória (entra no retry).
  const stuck = await db
    .select()
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.status, "running"),
        isNotNull(processingJobs.providerJobId),
        inArray(processingJobs.stage, STAGES),
        lt(processingJobs.createdAt, new Date(Date.now() - STUCK_RUNNING_MS)),
      ),
    )
    .limit(pollBatch);
  for (const job of stuck) {
    // Dá uma última chance ao provider: pode ter terminado e ninguém consultou.
    const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
    const out = song ? await pollJob(job, song) : "failed";
    if (out === "running") {
      await failOrRetry(job, "predição sem resposta (timeout)");
      s.timedOut++;
    }
  }

  // 3. Fecha o que está rodando.
  const running = await db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.status, "running"), isNotNull(processingJobs.providerJobId), inArray(processingJobs.stage, STAGES)))
    .orderBy(asc(processingJobs.id))
    .limit(pollBatch);
  for (const job of running) {
    if (left() < 8_000) break;
    s.checked++;
    const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
    if (!song) {
      await db
        .update(processingJobs)
        .set({ status: "failed", errorMessage: `${PERM_PREFIX} Música não encontrada`, completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      s.failed++;
      continue;
    }
    const out = await pollJob(job, song);
    if (out === "done") (job.stage === "chord_detection" ? s.chordsDone++ : s.lyricsDone++);
    else if (out === "retry") s.retried++;
    else if (out === "failed") s.failed++;
    else s.stillRunning++;
  }

  // 4. Submete a fila (inclui os que acabaram de voltar p/ pending).
  const pending = await db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.status, "pending"), isNull(processingJobs.providerJobId), inArray(processingJobs.stage, STAGES)))
    .orderBy(asc(processingJobs.id))
    .limit(submitBatch);
  for (const job of pending) {
    if (left() < 4_000) break;
    const r = await submitJob(job);
    if (r === "throttled") { s.throttled = true; break; }
    if (r === "submitted") { s.submitted++; await sleep(1200); }
    if (r === "retry") s.retried++;
    if (r === "failed") s.failed++;
  }

  const remaining = await db
    .select({ id: processingJobs.id })
    .from(processingJobs)
    .where(and(eq(processingJobs.status, "pending"), isNull(processingJobs.providerJobId), inArray(processingJobs.stage, STAGES)))
    .limit(500);
  s.pendingLeft = remaining.length;
  return s;
}
