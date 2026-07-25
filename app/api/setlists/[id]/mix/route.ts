/**
 * Mixagem do setlist (Fase S2 / ADR-BTS-005, D5).
 *   GET → tudo que a aba Mixagem precisa: repertório, stems de cada música,
 *         camada 1 (padrão), camada 3 (meu override) e o meu instrumento.
 *   PUT → grava. Duas rotas de escrita no mesmo endpoint, com donos distintos:
 *           · scope "setlist" → só o LÍDER (D11)
 *           · scope "user"    → cada um, só o seu (D5, camada 3)
 *
 * O padrão de setlist é gravado por upsert manual: o índice único
 * (setlist_song_id, stem_key) garante uma linha por stem.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  db,
  setlistSongs,
  setlistSongMix,
  setlistSongMixUser,
  songs,
  stems,
} from "@/src/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resolveSetlistRole, canManageEvent } from "@/src/lib/events";
import { MIX_STATES, type MixState } from "@/src/lib/mix";

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
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, setlistId))
      .orderBy(asc(setlistSongs.position), asc(setlistSongs.id));

    if (items.length === 0) {
      return NextResponse.json({
        role: role.kind,
        viewerInstrument: role.instrument,
        items: [],
        stemsBySong: {},
        setlistMix: [],
        userMix: [],
      });
    }

    const songIds = items.map((i) => i.songId);
    const setlistSongIds = items.map((i) => i.setlistSongId);

    // Quais stems cada música tem de fato — a grade não pode oferecer uma
    // coluna de guitarra para uma música que não foi separada com guitarra.
    const stemRows = await db
      .select({ songId: stems.songId, instrument: stems.instrument })
      .from(stems)
      .where(inArray(stems.songId, songIds));

    const stemsBySong: Record<number, string[]> = {};
    for (const s of stemRows) {
      (stemsBySong[s.songId] ??= []).push(s.instrument);
    }

    const setlistMix = await db
      .select({
        setlistSongId: setlistSongMix.setlistSongId,
        stemKey: setlistSongMix.stemKey,
        state: setlistSongMix.state,
        volume: setlistSongMix.volume,
      })
      .from(setlistSongMix)
      .where(inArray(setlistSongMix.setlistSongId, setlistSongIds));

    const userMix = await db
      .select({
        setlistSongId: setlistSongMixUser.setlistSongId,
        stemKey: setlistSongMixUser.stemKey,
        state: setlistSongMixUser.state,
        volume: setlistSongMixUser.volume,
      })
      .from(setlistSongMixUser)
      .where(
        and(
          inArray(setlistSongMixUser.setlistSongId, setlistSongIds),
          eq(setlistSongMixUser.userId, userId),
        ),
      );

    return NextResponse.json({
      role: role.kind,
      viewerInstrument: role.instrument,
      items,
      stemsBySong,
      setlistMix,
      userMix,
    });
  } catch (err) {
    console.error("[GET /api/setlists/:id/mix]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const body = (await req.json()) as {
      scope?: "setlist" | "user";
      setlistSongId?: number;
      stemKey?: string;
      state?: string;
      volume?: number;
    };

    const scope = body.scope ?? "setlist";
    if (scope === "setlist" && !canManageEvent(role)) {
      return NextResponse.json({ error: "Só o líder define a mixagem do setlist" }, { status: 403 });
    }

    if (!body.setlistSongId || !body.stemKey) {
      return NextResponse.json({ error: "setlistSongId e stemKey são obrigatórios" }, { status: 400 });
    }

    const state = (body.state ?? "on") as MixState;
    if (!MIX_STATES.includes(state)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const volume = Math.max(0, Math.min(100, Math.round(body.volume ?? 100)));

    // A música tem de pertencer a ESTE setlist — impede escrever mixagem em
    // repertório alheio com um ID adivinhado.
    const [owned] = await db
      .select({ id: setlistSongs.id })
      .from(setlistSongs)
      .where(and(eq(setlistSongs.id, body.setlistSongId), eq(setlistSongs.setlistId, setlistId)))
      .limit(1);
    if (!owned) return NextResponse.json({ error: "Música não está neste setlist" }, { status: 400 });

    if (scope === "setlist") {
      const [existing] = await db
        .select({ id: setlistSongMix.id })
        .from(setlistSongMix)
        .where(
          and(
            eq(setlistSongMix.setlistSongId, body.setlistSongId),
            eq(setlistSongMix.stemKey, body.stemKey),
          ),
        )
        .limit(1);

      const row = existing
        ? (await db.update(setlistSongMix).set({ state, volume }).where(eq(setlistSongMix.id, existing.id)).returning())[0]
        : (await db.insert(setlistSongMix).values({ setlistSongId: body.setlistSongId, stemKey: body.stemKey, state, volume }).returning())[0];

      return NextResponse.json({ mix: row });
    }

    const [existing] = await db
      .select({ id: setlistSongMixUser.id })
      .from(setlistSongMixUser)
      .where(
        and(
          eq(setlistSongMixUser.setlistSongId, body.setlistSongId),
          eq(setlistSongMixUser.userId, userId),
          eq(setlistSongMixUser.stemKey, body.stemKey),
        ),
      )
      .limit(1);

    const row = existing
      ? (await db.update(setlistSongMixUser).set({ state, volume }).where(eq(setlistSongMixUser.id, existing.id)).returning())[0]
      : (await db.insert(setlistSongMixUser).values({ setlistSongId: body.setlistSongId, userId, stemKey: body.stemKey, state, volume }).returning())[0];

    return NextResponse.json({ mix: row });
  } catch (err) {
    console.error("[PUT /api/setlists/:id/mix]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** DELETE → zera o override pessoal daquela música (volta ao padrão do líder). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const setlistSongId = Number(req.nextUrl.searchParams.get("setlistSongId"));
    if (!setlistSongId) return NextResponse.json({ error: "setlistSongId obrigatório" }, { status: 400 });

    // Só apaga o próprio override — o padrão do setlist não sai por aqui.
    await db
      .delete(setlistSongMixUser)
      .where(
        and(
          eq(setlistSongMixUser.setlistSongId, setlistSongId),
          eq(setlistSongMixUser.userId, userId),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/setlists/:id/mix]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
