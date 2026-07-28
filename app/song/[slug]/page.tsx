import { notFound } from "next/navigation";
import {
  db,
  songs as songsTable,
  stems as stemsTable,
  setlistSongs,
  setlistSongMix,
  setlistSongMixUser,
  setlists,
} from "@/src/db";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasProAccess } from "@/src/lib/access";
import { resolveSetlistRole } from "@/src/lib/events";
import { resolveMix, parseSpeed, clampTranspose, type ResolvedStem } from "@/src/lib/mix";
import { markFirstUse } from "@/src/lib/invites";
import SongPlayer from "./SongPlayer";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song) return {};
  return {
    title: `${song.title} | BackingTrack.store`,
    description: `Cifra e backing track de ${song.title} por ${song.artist}. Tom: ${song.key}, ${song.bpm} BPM.`,
  };
}

export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ solo?: string; loop?: string; sl?: string }>;
}) {
  const { slug } = await params;
  const { solo, loop, sl } = await searchParams;
  const [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song) notFound();
  // Takedown/moderação: música bloqueada some do site (R3 / ADR-BTS-003).
  if (song.moderationStatus === "blocked") notFound();

  const stems = await db.select().from(stemsTable).where(eq(stemsTable.songId, song.id));

  const session = await auth();
  // Acesso Pro efetivo: role pro/proband/admin OU membro ativo de banda com
  // assinatura ativa (herda). Habilita o multitrack para o integrante de banda.
  const isPro = session?.user
    ? await hasProAccess(Number(session.user.id), session.user.role)
    : false;

  // Funil do convite: abrir a página de uma música conta como "primeiro uso".
  // UPDATE indexado por user_id que só acerta linha na primeira vez; nas demais
  // é um no-op. Best-effort — markFirstUse engole o próprio erro.
  if (session?.user?.id) await markFirstUse(Number(session.user.id));

  // Trilha-guia: quando aberto pela setlist da banda, ?solo=<instrumento> faz o
  // player vir com só a trilha do integrante no ar (pré-muta as outras).
  const soloInstrument = solo?.trim() || null;

  // Trecho a estudar (S1 / ADR-BTS-005): ?loop=início-fim em segundos, vindo da
  // escalação do ensaio. Entrada é da URL — valida antes de passar ao player.
  const [loopStart, loopEnd] = (() => {
    const m = loop?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
    if (!m) return [null, null] as const;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return [null, null] as const;
    return [a, b] as const;
  })();

  // ── Mixagem do setlist (S2 / ADR-BTS-005) ──────────────────────────────────
  // ?sl=<setlistSongId> diz "abri esta música PELO setlist X". Sem isso a
  // música vem no mix original — o preparo do líder não vaza para o catálogo.
  let setlistMix: ResolvedStem[] | null = null;
  let setlistName: string | null = null;
  let mixTranspose = 0;
  let mixSpeed = 1;

  const setlistSongId = Number(sl);
  if (setlistSongId && session?.user) {
    const userId = Number(session.user.id);
    const [item] = await db
      .select({
        id: setlistSongs.id,
        setlistId: setlistSongs.setlistId,
        songId: setlistSongs.songId,
        transposeSemitones: setlistSongs.transposeSemitones,
        speed: setlistSongs.speed,
      })
      .from(setlistSongs)
      .where(and(eq(setlistSongs.id, setlistSongId), eq(setlistSongs.songId, song.id)))
      .limit(1);

    if (item) {
      // Reusa a autorização dos ensaios: dono, líder ou membro ativo. Sem isto,
      // qualquer logado leria a mixagem de um setlist alheio pelo ID na URL.
      const role = await resolveSetlistRole(item.setlistId, userId);
      if (role.kind === "leader" || role.kind === "member") {
        const layer1 = await db
          .select({ stemKey: setlistSongMix.stemKey, state: setlistSongMix.state, volume: setlistSongMix.volume })
          .from(setlistSongMix)
          .where(eq(setlistSongMix.setlistSongId, item.id));

        const layer3 = await db
          .select({ stemKey: setlistSongMixUser.stemKey, state: setlistSongMixUser.state, volume: setlistSongMixUser.volume })
          .from(setlistSongMixUser)
          .where(
            and(
              eq(setlistSongMixUser.setlistSongId, item.id),
              eq(setlistSongMixUser.userId, userId),
            ),
          );

        // Camada 2 (auto-mute) só quando NÃO se pediu o modo "ouvir como é":
        // ?solo= isola a trilha do integrante e é o oposto de tocar junto.
        const autoMute = soloInstrument ? null : role.instrument;

        setlistMix = resolveMix(stems.map((s) => s.instrument), layer1, autoMute, layer3);
        mixTranspose = clampTranspose(item.transposeSemitones ?? 0);
        mixSpeed = parseSpeed(item.speed);

        const [sName] = await db
          .select({ name: setlists.name })
          .from(setlists)
          .where(eq(setlists.id, item.setlistId))
          .limit(1);
        setlistName = sName?.name ?? null;
      }
    }
  }

  return (
    <SongPlayer
      song={song}
      stems={stems}
      isPro={isPro}
      soloInstrument={soloInstrument}
      loopStart={loopStart}
      loopEnd={loopEnd}
      setlistMix={setlistMix}
      setlistName={setlistName}
      setlistTranspose={mixTranspose}
      setlistSpeed={mixSpeed}
      header={<SiteHeader />}
      footer={<SiteFooter />}
    />
  );
}
