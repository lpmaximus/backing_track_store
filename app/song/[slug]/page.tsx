import { notFound } from "next/navigation";
import { db, songs as songsTable, stems as stemsTable } from "@/src/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import SongPlayer from "./SongPlayer";

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

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song) notFound();

  const stems = await db.select().from(stemsTable).where(eq(stemsTable.songId, song.id));

  const session = await auth();
  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  return <SongPlayer song={song} stems={stems} isPro={isPro} />;
}
