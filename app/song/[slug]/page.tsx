import { notFound } from "next/navigation";
import { db, songs as songsTable, stems as stemsTable } from "@/src/db";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { hasProAccess } from "@/src/lib/access";
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
  searchParams: Promise<{ solo?: string }>;
}) {
  const { slug } = await params;
  const { solo } = await searchParams;
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

  // Trilha-guia: quando aberto pela setlist da banda, ?solo=<instrumento> faz o
  // player vir com só a trilha do integrante no ar (pré-muta as outras).
  const soloInstrument = solo?.trim() || null;

  return (
    <SongPlayer
      song={song}
      stems={stems}
      isPro={isPro}
      soloInstrument={soloInstrument}
      header={<SiteHeader />}
      footer={<SiteFooter />}
    />
  );
}
