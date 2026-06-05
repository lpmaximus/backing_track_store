import { notFound } from "next/navigation";
import songs from "@/data/songs.json";
import SongPlayer from "./SongPlayer";

export function generateStaticParams() {
  return songs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const song = songs.find((s) => s.slug === slug);
  if (!song) return {};
  return {
    title: `${song.title} — ${song.artist} | BackingTrack.store`,
    description: `Cifra e backing track de ${song.title} por ${song.artist}. Tom: ${song.key}, ${song.bpm} BPM.`,
  };
}

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const song = songs.find((s) => s.slug === slug);
  if (!song) notFound();

  return <SongPlayer song={song} />;
}
