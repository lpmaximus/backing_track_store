import {
  db,
  songs,
  stems,
  setlists,
  setlistSongs,
  setlistEvents,
  bandMembers,
  bands,
  userActivity,
  notifications,
} from "@/src/db";
import { and, asc, count, desc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";

export type HomeSong = {
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  stemCount: number;
};

export type NextEvent = {
  id: number;
  setlistId: number;
  type: string;
  title: string;
  setlistName: string;
  startsAt: Date;
  location: string | null;
  songCount: number;
};

/** Setlists que a pessoa enxerga: as dela + as das bandas (líder ou membro ativo). */
async function visibleBandIds(userId: number): Promise<number[]> {
  const [asMember, asLeader] = await Promise.all([
    db.select({ bandId: bandMembers.bandId }).from(bandMembers)
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active"))),
    db.select({ bandId: bands.id }).from(bands).where(eq(bands.leaderUserId, userId)),
  ]);
  return Array.from(new Set([...asMember, ...asLeader].map((r) => r.bandId)));
}

/** Próximo ensaio/show (a partir de agora). */
export async function getNextEvent(userId: number): Promise<NextEvent | null> {
  const bandIds = await visibleBandIds(userId);
  const owner = eq(setlists.userId, userId);
  const where = bandIds.length ? or(owner, inArray(setlists.bandId, bandIds)) : owner;

  const [ev] = await db
    .select({
      id: setlistEvents.id,
      setlistId: setlistEvents.setlistId,
      type: setlistEvents.type,
      title: setlistEvents.title,
      startsAt: setlistEvents.startsAt,
      location: setlistEvents.location,
      setlistName: setlists.name,
    })
    .from(setlistEvents)
    .innerJoin(setlists, eq(setlists.id, setlistEvents.setlistId))
    .where(and(gte(setlistEvents.startsAt, new Date()), where))
    .orderBy(asc(setlistEvents.startsAt))
    .limit(1);
  if (!ev) return null;

  const [{ n }] = await db
    .select({ n: count() })
    .from(setlistSongs)
    .where(eq(setlistSongs.setlistId, ev.setlistId));
  return { ...ev, songCount: Number(n) };
}

/**
 * "Continuar praticando": as últimas músicas que a pessoa tocou ou abriu a
 * cifra (log de atividade). Sem histórico, cai nas músicas que ela enviou.
 */
export async function getRecentSongs(userId: number, limit = 4): Promise<HomeSong[]> {
  const recent = await db
    .select({ songId: userActivity.songId, last: sql<Date>`max(${userActivity.createdAt})` })
    .from(userActivity)
    .where(and(eq(userActivity.userId, userId), inArray(userActivity.event, ["play", "cifra", "letra"])))
    .groupBy(userActivity.songId)
    .orderBy(desc(sql`max(${userActivity.createdAt})`))
    .limit(limit + 4);

  let ids = recent.map((r) => r.songId).filter((v): v is number => typeof v === "number");

  if (ids.length === 0) {
    const own = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.uploadedByUserId, userId), eq(songs.processingStatus, "ready"), ne(songs.sourceType, "studio_project")))
      .orderBy(desc(songs.createdAt))
      .limit(limit);
    ids = own.map((r) => r.id);
  }
  if (ids.length === 0) return [];

  const rows = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      key: songs.key,
      bpm: songs.bpm,
      sourceType: songs.sourceType,
      uploadedByUserId: songs.uploadedByUserId,
      stemCount: sql<number>`(select count(*) from ${stems} where ${stems.songId} = ${songs.id})`,
    })
    .from(songs)
    .where(and(inArray(songs.id, ids), ne(songs.moderationStatus, "blocked")));

  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    // Projeto de estúdio de outra pessoa nunca aparece (o player daria 404).
    .filter((r): r is NonNullable<typeof r> => !!r && (r.sourceType !== "studio_project" || r.uploadedByUserId === userId))
    .slice(0, limit)
    .map((r) => ({ slug: r.slug, title: r.title, artist: r.artist, key: r.key, bpm: r.bpm, stemCount: Number(r.stemCount) }));
}

export async function getUnreadCount(userId: number): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return Number(n);
}
