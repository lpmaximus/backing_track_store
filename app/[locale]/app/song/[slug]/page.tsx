import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, songs as songsTable, stems as stemsTable } from "@/src/db";
import type { Locale } from "@/src/i18n/routing";
import { hasProAccess } from "@/src/lib/access";
import { localizeSongTitle } from "@/src/lib/catalogTitles";
import { markFirstUse } from "@/src/lib/invites";
import AppSongScreen from "./AppSongScreen";
import { loadSetlistMix } from "../../_lib/setlistMix";

export const dynamic = "force-dynamic";

/**
 * Player + cifra do app (Player.dc.html / Cifra.dc.html).
 *
 * Mesmas regras de acesso da página do site (/song/[slug]): moderação bloqueia,
 * projeto de estúdio só para o dono (404 para não confirmar que existe), e o
 * multitrack depende do acesso Pro efetivo. O motor de áudio também é o mesmo
 * (WavePlayer); o que muda é a casca mobile.
 */
export default async function AppSongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
  searchParams: Promise<{ aba?: string; sl?: string; solo?: string }>;
}) {
  const { slug, locale } = await params;
  setRequestLocale(locale);
  const { aba, sl, solo } = await searchParams;

  const [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song || song.moderationStatus === "blocked") notFound();

  const session = await auth();
  if (
    song.sourceType === "studio_project" &&
    (!session?.user || song.uploadedByUserId !== Number(session.user.id))
  ) {
    notFound();
  }

  const stems = await db.select().from(stemsTable).where(eq(stemsTable.songId, song.id));
  const isPro = session?.user ? await hasProAccess(Number(session.user.id), session.user.role) : false;
  if (session?.user?.id) await markFirstUse(Number(session.user.id));

  // Aberta pelo setlist (?sl=): mixagem, tom e velocidade combinados com a banda.
  const soloInstrument = solo?.trim() || null;
  const setlistMix = session?.user?.id && isPro
    ? await loadSetlistMix({
        setlistSongId: Number(sl) || 0,
        songId: song.id,
        userId: Number(session.user.id),
        stemKeys: stems.map((s) => s.instrument),
        solo: soloInstrument,
      }).catch(() => null)
    : null;

  return (
    <AppSongScreen
      initialTab={aba === "cifra" ? "cifra" : "faixas"}
      soloInstrument={soloInstrument}
      setlist={setlistMix ? {
        id: setlistMix.setlistId,
        name: setlistMix.setlistName,
        mix: setlistMix.mix,
        transpose: setlistMix.transpose,
        speed: setlistMix.speed,
      } : null}
      isPro={isPro}
      song={{
        id: song.id,
        slug: song.slug,
        title: localizeSongTitle(song.title, locale),
        artist: song.artist,
        key: song.key,
        bpm: song.bpm,
        duration: song.duration,
        audioUrl: song.audioUrl,
        chords: song.chords ?? null,
        lyrics: song.lyrics ?? null,
        cifraText: song.cifraText ?? null,
        projectMode: song.sourceType === "studio_project",
      }}
      stems={stems.map((s) => ({ id: s.id, instrument: s.instrument, label: s.label, audioUrl: s.audioUrl }))}
    />
  );
}
