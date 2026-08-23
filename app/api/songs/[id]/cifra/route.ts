/**
 * PATCH /api/songs/:id/cifra — correção de LETRA e CIFRA em uma operação só.
 *
 * O editor gravava nos dois endpoints antigos (/lyrics e /chords) com um
 * Promise.all. Duas requisições independentes, sem transação: bastava uma falhar
 * (403 por plano, 500, queda de rede) para a música ficar com letra nova e cifra
 * velha, desalinhadas — e a única saída oferecida era "tente de novo", que
 * gravava por cima do estado meio-salvo.
 *
 * Aqui as duas colunas vão no MESMO UPDATE. O driver do Neon é HTTP e não tem
 * transação multi-statement, então a atomicidade vem de ser um comando só.
 *
 * As rotas antigas continuam existindo (o editor de letra simples ainda usa a
 * de /lyrics); esta é a que o CifraEditor passou a chamar.
 *
 * Body: { lyrics?: LyricsLine[], chords?: ChordSection[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, cifraEditHistory } from "@/src/db";
import { eq } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import type { ChordSection, LyricsLine } from "@/src/db/schema";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Mantém as linhas em ordem de tempo. Linha de texto VAZIO é preservada quando
 * está no meio: ela é a âncora de um trecho instrumental (acordes sem letra) —
 * sem ela, a tela de leitura gruda esses acordes na linha de cima. Vazios nas
 * pontas e vazios em sequência são aparados.
 */
function cleanLyrics(input: unknown): LyricsLine[] {
  if (!Array.isArray(input)) return [];
  const rows = input
    .filter((l): l is LyricsLine =>
      Boolean(l) && typeof (l as LyricsLine).text === "string" && Number.isFinite(Number((l as LyricsLine).time)))
    .map((l) => ({ time: r1(Number(l.time)), text: l.text.replace(/\s+$/, "") }))
    .sort((a, b) => a.time - b.time);

  const out: LyricsLine[] = [];
  for (const row of rows) {
    if (!row.text.trim()) {
      if (out.length === 0) continue;                       // vazio antes da 1ª linha
      if (!out[out.length - 1].text.trim()) continue;       // vazios em sequência
    }
    out.push(row);
  }
  while (out.length && !out[out.length - 1].text.trim()) out.pop(); // vazio no fim
  return out;
}

/** Ordena a cifra por tempo — a letra sempre foi ordenada, a cifra não era. */
function cleanChords(input: unknown): ChordSection[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((c): c is ChordSection =>
      Boolean(c) && typeof (c as ChordSection).chords === "string"
      && (c as ChordSection).chords.trim().length > 0
      && Number.isFinite(Number((c as ChordSection).timecode)))
    .map((c) => ({
      section: typeof c.section === "string" ? c.section.slice(0, 40) : "",
      timecode: r1(Number(c.timecode)),
      chords: c.chords.replace(/\s+$/, ""),
      ...(Array.isArray(c.times) ? { times: c.times.map(Number).filter(Number.isFinite) } : {}),
      ...(c.aligned ? { aligned: true as const } : {}),
    }))
    .sort((a, b) => a.timecode - b.timecode);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Correção de letra e cifra é recurso do plano Pro" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = (await req.json()) as { lyrics?: unknown; chords?: unknown };
    if (body.lyrics === undefined && body.chords === undefined) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

    const newLyrics = body.lyrics !== undefined ? cleanLyrics(body.lyrics) : song.lyrics;
    const newChords = body.chords !== undefined ? cleanChords(body.chords) : song.chords;

    // Snapshot do estado anterior (para reverter na moderação).
    await db.insert(cifraEditHistory).values({
      songId,
      userId: Number(session.user.id),
      previousChords: song.chords ?? null,
      newChords: newChords ?? null,
      previousCifraText: song.cifraText ?? null,
      newCifraText: song.cifraText ?? null,
    });

    const [updated] = await db
      .update(songs)
      .set({
        lyrics: newLyrics ?? null,
        lyricsSource: "community",
        lyricsStatus: "validated",
        chords: newChords ?? null,
        chordsSource: "community",
        chordsStatus: "validated",
        updatedAt: new Date(),
      })
      .where(eq(songs.id, songId))
      .returning();

    return NextResponse.json({
      song: {
        id: updated.id,
        lyrics: updated.lyrics,
        chords: updated.chords,
        lyricsStatus: updated.lyricsStatus,
        chordsStatus: updated.chordsStatus,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/songs/:id/cifra]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
