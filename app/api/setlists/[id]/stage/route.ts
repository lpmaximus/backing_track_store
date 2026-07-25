/**
 * Modo palco — execução contínua do setlist (Fase S3 / ADR-BTS-005, §6).
 *
 * Um único GET devolve tudo que o motor de palco (useStageEngine) precisa para
 * tocar o repertório inteiro sem voltar ao servidor entre músicas: stems,
 * mixagem já resolvida nas três camadas (mesma lógica de src/lib/mix.ts usada
 * na aba Mixagem), tom/velocidade/intervalo do preparo (S2), cifra e letra.
 *
 * Por que uma rota nova em vez de reusar GET /api/setlists/:id ou .../mix:
 * nenhuma das duas traz cifra/letra nem os stems com audioUrl — o palco
 * precisa carregar áudio de cada stem diretamente (ver stagePreload.ts), não
 * só saber quais existem. Buscar música por música na hora da troca é o que a
 * pré-carga em janela deslizante existe para evitar.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlistSongs, setlistSongMix, setlistSongMixUser, songs, stems } from "@/src/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resolveSetlistRole } from "@/src/lib/events";
import { resolveMix, parseSpeed, clampTranspose, type ResolvedStem } from "@/src/lib/mix";

const STEM_ORDER = ["vocal", "melody", "guitar", "harmony", "bass", "drums"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const setlistId = Number(idParam);
  if (!setlistId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const role = await resolveSetlistRole(setlistId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (role.kind === "forbidden") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  try {
    const items = await db
      .select({
        setlistSongId: setlistSongs.id,
        position: setlistSongs.position,
        transposeSemitones: setlistSongs.transposeSemitones,
        speed: setlistSongs.speed,
        gapSeconds: setlistSongs.gapSeconds,
        songId: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        key: songs.key,
        bpm: songs.bpm,
        duration: songs.duration,
        thumbnailUrl: songs.thumbnailUrl,
        cifraText: songs.cifraText,
        chords: songs.chords,
        lyrics: songs.lyrics,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, setlistId))
      .orderBy(asc(setlistSongs.position), asc(setlistSongs.id));

    if (items.length === 0) {
      return NextResponse.json({ role: role.kind, viewerInstrument: role.instrument, songs: [] });
    }

    const songIds = items.map((i) => i.songId);
    const setlistSongIds = items.map((i) => i.setlistSongId);

    const stemRows = await db
      .select({ songId: stems.songId, instrument: stems.instrument, label: stems.label, audioUrl: stems.audioUrl })
      .from(stems)
      .where(inArray(stems.songId, songIds));

    const stemsBySong = new Map<number, typeof stemRows>();
    for (const s of stemRows) {
      const list = stemsBySong.get(s.songId) ?? [];
      list.push(s);
      stemsBySong.set(s.songId, list);
    }

    const setlistMixRows = await db
      .select({ setlistSongId: setlistSongMix.setlistSongId, stemKey: setlistSongMix.stemKey, state: setlistSongMix.state, volume: setlistSongMix.volume })
      .from(setlistSongMix)
      .where(inArray(setlistSongMix.setlistSongId, setlistSongIds));

    const userMixRows = await db
      .select({ setlistSongId: setlistSongMixUser.setlistSongId, stemKey: setlistSongMixUser.stemKey, state: setlistSongMixUser.state, volume: setlistSongMixUser.volume })
      .from(setlistSongMixUser)
      .where(and(inArray(setlistSongMixUser.setlistSongId, setlistSongIds), eq(setlistSongMixUser.userId, userId)));

    // Camada 2 (auto-mute): o próprio instrumento do integrante — mesma regra
    // de mix.ts / page.tsx da música avulsa. Sem exceção para "?solo=" aqui:
    // o palco é sempre "tocar junto" (não existe o modo "ouvir como é" no
    // modo de execução contínua da banda).
    const myInstrument = role.instrument;

    const stageSongs = items.map((it) => {
      const rows = stemsBySong.get(it.songId) ?? [];
      const orderedStems = STEM_ORDER
        .map((key) => rows.find((r) => r.instrument === key))
        .filter((r): r is (typeof rows)[number] => Boolean(r));

      const mix: ResolvedStem[] = resolveMix(
        orderedStems.map((s) => s.instrument),
        setlistMixRows.filter((m) => m.setlistSongId === it.setlistSongId),
        myInstrument,
        userMixRows.filter((m) => m.setlistSongId === it.setlistSongId),
      );

      return {
        setlistSongId: it.setlistSongId,
        position: it.position,
        songId: it.songId,
        slug: it.slug,
        title: it.title,
        artist: it.artist,
        key: it.key,
        bpm: it.bpm,
        duration: it.duration,
        thumbnailUrl: it.thumbnailUrl,
        transposeSemitones: clampTranspose(it.transposeSemitones ?? 0),
        speed: parseSpeed(it.speed),
        gapSeconds: it.gapSeconds ?? 0,
        stems: orderedStems.map((s) => ({ instrument: s.instrument, label: s.label, audioUrl: s.audioUrl })),
        mix,
        cifraText: it.cifraText,
        chords: it.chords,
        lyrics: it.lyrics,
      };
    });

    return NextResponse.json({
      role: role.kind,
      viewerInstrument: role.instrument,
      songs: stageSongs,
    });
  } catch (err) {
    console.error("[GET /api/setlists/:id/stage]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
