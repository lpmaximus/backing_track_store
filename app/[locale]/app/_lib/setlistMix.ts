/**
 * Mixagem do setlist para o player do app (S2 / ADR-BTS-005).
 *
 * Mesma regra da página do site (app/[locale]/song/[slug]/page.tsx): ?sl=<id
 * da linha setlist_songs> diz "abri esta música PELO setlist". Só dono, líder
 * ou membro ativo leem a mixagem; camada 2 (auto-mute da trilha do integrante)
 * fica de fora quando se pediu ?solo=.
 */
import { db, setlistSongs, setlistSongMix, setlistSongMixUser, setlists } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { resolveSetlistRole } from "@/src/lib/events";
import { resolveMix, parseSpeed, clampTranspose, type ResolvedStem } from "@/src/lib/mix";

export type AppSetlistMix = {
  mix: ResolvedStem[];
  setlistId: number;
  setlistName: string | null;
  transpose: number;
  speed: number;
};

export async function loadSetlistMix(opts: {
  setlistSongId: number;
  songId: number;
  userId: number;
  stemKeys: string[];
  solo: string | null;
}): Promise<AppSetlistMix | null> {
  const { setlistSongId, songId, userId, stemKeys, solo } = opts;
  if (!setlistSongId) return null;

  const [item] = await db
    .select({
      id: setlistSongs.id,
      setlistId: setlistSongs.setlistId,
      transposeSemitones: setlistSongs.transposeSemitones,
      speed: setlistSongs.speed,
    })
    .from(setlistSongs)
    .where(and(eq(setlistSongs.id, setlistSongId), eq(setlistSongs.songId, songId)))
    .limit(1);
  if (!item) return null;

  const role = await resolveSetlistRole(item.setlistId, userId);
  if (role.kind !== "leader" && role.kind !== "member") return null;

  const [layer1, layer3, nameRow] = await Promise.all([
    db
      .select({ stemKey: setlistSongMix.stemKey, state: setlistSongMix.state, volume: setlistSongMix.volume })
      .from(setlistSongMix)
      .where(eq(setlistSongMix.setlistSongId, item.id)),
    db
      .select({ stemKey: setlistSongMixUser.stemKey, state: setlistSongMixUser.state, volume: setlistSongMixUser.volume })
      .from(setlistSongMixUser)
      .where(and(eq(setlistSongMixUser.setlistSongId, item.id), eq(setlistSongMixUser.userId, userId))),
    db.select({ name: setlists.name }).from(setlists).where(eq(setlists.id, item.setlistId)).limit(1),
  ]);

  const autoMute = solo ? null : role.instrument;
  return {
    mix: resolveMix(stemKeys, layer1, autoMute, layer3),
    setlistId: item.setlistId,
    setlistName: nameRow[0]?.name ?? null,
    transpose: clampTranspose(item.transposeSemitones ?? 0),
    speed: parseSpeed(item.speed),
  };
}
