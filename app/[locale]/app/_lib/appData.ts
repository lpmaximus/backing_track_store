/**
 * Dados das telas Setlists, Setlist, Banda, Conta e Mensagens do app.
 *
 * Lidos direto no servidor (sem passar pelas rotas /api) com AS MESMAS regras
 * de acesso das rotas: setlist = dono ou membro ativo da banda dona; banda =
 * líder ou membro ativo. Se uma regra mudar numa rota, mude aqui também.
 */
import {
  db,
  users,
  songs,
  setlists,
  setlistSongs,
  setlistEvents,
  bands,
  bandMembers,
  notifications,
} from "@/src/db";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { resolveSetlistRole } from "@/src/lib/events";

// ── Bandas ───────────────────────────────────────────────────────────────────

export type AppBandMember = {
  id: number;
  userId: number | null;
  display: string;
  instrument: string | null;
  status: string; // invited | active
  isLeader: boolean;
  isMe: boolean;
};

export type AppBand = {
  id: number;
  name: string;
  isLeader: boolean;
  hasSubscription: boolean;
  members: AppBandMember[];
};

/** Bandas em que a pessoa é líder ou membro ativo, com os integrantes. */
export async function getBandsWithMembers(userId: number): Promise<AppBand[]> {
  const [led, asMember] = await Promise.all([
    db.select().from(bands).where(eq(bands.leaderUserId, userId)),
    db
      .select({ band: bands })
      .from(bandMembers)
      .innerJoin(bands, eq(bandMembers.bandId, bands.id))
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active"))),
  ]);
  const map = new Map<number, typeof bands.$inferSelect>();
  for (const b of led) map.set(b.id, b);
  for (const r of asMember) map.set(r.band.id, r.band);
  const list = Array.from(map.values()).sort((a, b) => b.id - a.id);
  if (list.length === 0) return [];

  const rows = await db
    .select({
      id: bandMembers.id,
      bandId: bandMembers.bandId,
      userId: bandMembers.userId,
      instrument: bandMembers.instrument,
      status: bandMembers.status,
      invitedEmail: bandMembers.invitedEmail,
      email: users.email,
      name: users.name,
    })
    .from(bandMembers)
    .leftJoin(users, eq(bandMembers.userId, users.id))
    .where(inArray(bandMembers.bandId, list.map((b) => b.id)))
    .orderBy(asc(bandMembers.id));

  return list.map((b) => ({
    id: b.id,
    name: b.name,
    isLeader: b.leaderUserId === userId,
    hasSubscription: b.subscriptionId != null,
    members: rows
      .filter((m) => m.bandId === b.id)
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        display: m.name || m.email || m.invitedEmail || "",
        instrument: m.instrument,
        status: m.status,
        isLeader: m.userId === b.leaderUserId,
        isMe: m.userId === userId,
      }))
      // Líder primeiro, depois ativos, convidados por último.
      .sort((x, y) => Number(y.isLeader) - Number(x.isLeader) || Number(x.status !== "active") - Number(y.status !== "active")),
  }));
}

// ── Setlists ─────────────────────────────────────────────────────────────────

export type AppSetlistRow = {
  id: number;
  name: string;
  bandId: number | null;
  bandName: string | null;
  songCount: number;
  updatedAt: Date;
  nextEvent: { title: string; type: string; startsAt: Date } | null;
};

async function activeBandIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ bandId: bandMembers.bandId })
    .from(bandMembers)
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active")));
  return rows.map((r) => r.bandId);
}

/** Setlists pessoais + das bandas em que é membro ativo (mesma regra do GET /api/setlists). */
export async function getSetlists(userId: number): Promise<AppSetlistRow[]> {
  const bandIds = await activeBandIds(userId);
  const where = bandIds.length
    ? or(eq(setlists.userId, userId), inArray(setlists.bandId, bandIds))
    : eq(setlists.userId, userId);

  const rows = await db
    .select({
      id: setlists.id,
      name: setlists.name,
      bandId: setlists.bandId,
      bandName: bands.name,
      updatedAt: setlists.updatedAt,
      songCount: sql<number>`count(${setlistSongs.id})::int`,
    })
    .from(setlists)
    .leftJoin(setlistSongs, eq(setlistSongs.setlistId, setlists.id))
    .leftJoin(bands, eq(bands.id, setlists.bandId))
    .where(where)
    .groupBy(setlists.id, bands.name)
    .orderBy(desc(setlists.updatedAt));

  if (rows.length === 0) return [];

  // Próximo ensaio/show de cada setlist: o primeiro a partir de agora.
  const events = await db
    .select({
      setlistId: setlistEvents.setlistId,
      title: setlistEvents.title,
      type: setlistEvents.type,
      startsAt: setlistEvents.startsAt,
    })
    .from(setlistEvents)
    .where(and(inArray(setlistEvents.setlistId, rows.map((r) => r.id)), gte(setlistEvents.startsAt, new Date())))
    .orderBy(asc(setlistEvents.startsAt));
  const next = new Map<number, { title: string; type: string; startsAt: Date }>();
  for (const e of events) if (!next.has(e.setlistId)) next.set(e.setlistId, e);

  const out = rows.map((r) => ({ ...r, songCount: Number(r.songCount), nextEvent: next.get(r.id) ?? null }));
  // Com data marcada primeiro (mais próximo no topo); depois o resto por atualização.
  return out.sort((a, b) => {
    if (a.nextEvent && b.nextEvent) return a.nextEvent.startsAt.getTime() - b.nextEvent.startsAt.getTime();
    if (a.nextEvent) return -1;
    if (b.nextEvent) return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

export type AppSetlistSong = {
  itemId: number;
  position: number;
  notes: string | null;
  transpose: number;
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  duration: number;
  gapSeconds: number;
};

export type AppSetlistDetail = {
  id: number;
  name: string;
  notes: string | null;
  bandId: number | null;
  bandName: string | null;
  canManage: boolean;
  viewerInstrument: string | null;
  songs: AppSetlistSong[];
  members: AppBandMember[];
  nextEvent: { id: number; title: string; type: string; startsAt: Date; location: string | null } | null;
};

/** null = não existe ou sem acesso (a tela responde 404 nos dois casos). */
export async function getSetlistDetail(id: number, userId: number): Promise<AppSetlistDetail | null> {
  const [sl] = await db.select().from(setlists).where(eq(setlists.id, id)).limit(1);
  if (!sl) return null;

  // Mesma régua do resto do produto (src/lib/events.ts): dono/líder ou membro ativo.
  const role = await resolveSetlistRole(id, userId);
  if (role.kind !== "leader" && role.kind !== "member") return null;
  const viewerInstrument = role.instrument;

  const [items, eventRows, bandRow] = await Promise.all([
    db
      .select({
        itemId: setlistSongs.id,
        position: setlistSongs.position,
        notes: setlistSongs.notes,
        transpose: setlistSongs.transposeSemitones,
        gapSeconds: setlistSongs.gapSeconds,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        key: songs.key,
        bpm: songs.bpm,
        duration: songs.duration,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, id))
      .orderBy(asc(setlistSongs.position), asc(setlistSongs.id)),
    db
      .select({
        id: setlistEvents.id,
        title: setlistEvents.title,
        type: setlistEvents.type,
        startsAt: setlistEvents.startsAt,
        location: setlistEvents.location,
      })
      .from(setlistEvents)
      .where(and(eq(setlistEvents.setlistId, id), gte(setlistEvents.startsAt, new Date())))
      .orderBy(asc(setlistEvents.startsAt))
      .limit(1),
    sl.bandId
      ? db.select({ name: bands.name }).from(bands).where(eq(bands.id, sl.bandId)).limit(1)
      : Promise.resolve([] as { name: string }[]),
  ]);

  let members: AppBandMember[] = [];
  if (sl.bandId) {
    const all = await getBandsWithMembers(userId);
    members = all.find((b) => b.id === sl.bandId)?.members.filter((m) => m.status === "active") ?? [];
  }

  return {
    id: sl.id,
    name: sl.name,
    notes: sl.notes,
    bandId: sl.bandId,
    bandName: bandRow[0]?.name ?? null,
    canManage: role.kind === "leader",
    viewerInstrument,
    songs: items.map((it) => ({ ...it, transpose: it.transpose ?? 0, gapSeconds: it.gapSeconds ?? 0 })),
    members,
    nextEvent: eventRows[0] ?? null,
  };
}

// ── Conta e mensagens ────────────────────────────────────────────────────────

export async function getAccountBasics(userId: number) {
  const [me] = await db
    .select({ name: users.name, email: users.email, image: users.image, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me ?? null;
}

export type AppNotification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

export async function getNotifications(userId: number, limit = 50): Promise<AppNotification[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      read: notifications.read,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
