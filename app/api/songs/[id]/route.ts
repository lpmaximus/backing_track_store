/**
 * PATCH  /api/songs/:id  — o dono edita metadados e/ou o compartilhamento.
 * DELETE /api/songs/:id  — o dono apaga a própria música, SÓ se não estiver
 *                          compartilhada (protege o catálogo dos outros).
 *
 * Só o dono do upload (uploadedByUserId) ou um admin pode mexer. O slug/URL
 * nunca muda ao editar — evita quebrar links e setlists.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, stems } from "@/src/db";
import { eq } from "drizzle-orm";
import { deleteObject, keyFromPublicUrl } from "@/src/lib/r2";

// Só metadados editáveis pelo dono. Nada de slug, áudio, dono, status, etc.
type EditableBody = {
  title?: string;
  artist?: string;
  genre?: string;
  key?: string;
  bpm?: number;
  shared?: boolean;
  thumbnailUrl?: string | null;
};

const LIMITS = { title: 255, artist: 255, genre: 100, key: 10 } as const;

async function loadOwned(songId: number, userId: number, role?: string | null) {
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return { error: "Música não encontrada", status: 404 as const };
  const isOwner = song.uploadedByUserId === userId;
  const isAdmin = role === "admin";
  if (!isOwner && !isAdmin) return { error: "Sem permissão", status: 403 as const };
  return { song };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const owned = await loadOwned(songId, userId, session.user.role);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  let body: EditableBody;
  try {
    body = (await req.json()) as EditableBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const set: Partial<typeof songs.$inferInsert> = {};

  const cleanStr = (raw: unknown, field: keyof typeof LIMITS): { err?: string; value?: string } => {
    const v = String(raw).trim();
    if (!v) return { err: `Campo "${field}" não pode ficar vazio` };
    if (v.length > LIMITS[field]) return { err: `Campo "${field}" muito longo` };
    return { value: v };
  };

  if (body.title !== undefined) {
    const r = cleanStr(body.title, "title");
    if (r.err) return NextResponse.json({ error: r.err }, { status: 400 });
    set.title = r.value;
  }
  if (body.artist !== undefined) {
    const r = cleanStr(body.artist, "artist");
    if (r.err) return NextResponse.json({ error: r.err }, { status: 400 });
    set.artist = r.value;
  }
  if (body.genre !== undefined) {
    const r = cleanStr(body.genre, "genre");
    if (r.err) return NextResponse.json({ error: r.err }, { status: 400 });
    set.genre = r.value;
  }
  if (body.key !== undefined) {
    const r = cleanStr(body.key, "key");
    if (r.err) return NextResponse.json({ error: r.err }, { status: 400 });
    set.key = r.value;
  }

  if (body.bpm !== undefined) {
    const bpm = Number(body.bpm);
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) {
      return NextResponse.json({ error: "BPM deve estar entre 20 e 400" }, { status: 400 });
    }
    set.bpm = Math.round(bpm);
  }

  if (body.shared !== undefined) {
    set.shared = Boolean(body.shared);
  }

  // Thumbnail: aceita null (limpar) ou uma URL pública do NOSSO bucket R2.
  // Rejeita URLs externas — o objeto tem que estar hospedado por nós.
  let oldThumbToDelete: string | null = null;
  if (body.thumbnailUrl !== undefined) {
    if (body.thumbnailUrl === null || body.thumbnailUrl === "") {
      set.thumbnailUrl = null;
      oldThumbToDelete = owned.song.thumbnailUrl ?? null;
    } else {
      const key = keyFromPublicUrl(String(body.thumbnailUrl));
      if (!key || !key.startsWith("images/")) {
        return NextResponse.json({ error: "Thumbnail inválida" }, { status: 400 });
      }
      set.thumbnailUrl = String(body.thumbnailUrl);
      if (owned.song.thumbnailUrl && owned.song.thumbnailUrl !== body.thumbnailUrl) {
        oldThumbToDelete = owned.song.thumbnailUrl;
      }
    }
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }
  set.updatedAt = new Date();

  try {
    const [updated] = await db
      .update(songs)
      .set(set)
      .where(eq(songs.id, songId))
      .returning({
        id: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        genre: songs.genre,
        key: songs.key,
        bpm: songs.bpm,
        shared: songs.shared,
        thumbnailUrl: songs.thumbnailUrl,
      });

    // Best-effort: remove a thumbnail antiga do R2 quando foi trocada/limpa.
    if (oldThumbToDelete) {
      const oldKey = keyFromPublicUrl(oldThumbToDelete);
      if (oldKey) {
        deleteObject(oldKey).catch((e) =>
          console.warn("[PATCH song] falha ao remover thumbnail antiga", oldKey, e),
        );
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/songs/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const userId = Number(session.user.id);
  const owned = await loadOwned(songId, userId, session.user.role);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  // Regra de negócio: música compartilhada não pode ser apagada direto —
  // outros usuários podem estar usando. Descompartilhe primeiro.
  if (owned.song.shared) {
    return NextResponse.json(
      { error: "Descompartilhe a música antes de apagá-la." },
      { status: 409 },
    );
  }

  try {
    // Junta todas as URLs de mídia para limpar do R2 (mix + stems + thumbnail).
    const stemRows = await db.select({ audioUrl: stems.audioUrl }).from(stems).where(eq(stems.songId, songId));
    const urls = [
      owned.song.audioUrl,
      owned.song.thumbnailUrl,
      ...stemRows.map((s) => s.audioUrl),
    ].filter((u): u is string => Boolean(u));

    await Promise.all(
      urls.map(async (url) => {
        const key = keyFromPublicUrl(url);
        if (!key) return;
        try {
          await deleteObject(key);
        } catch (e) {
          // Best-effort: se um objeto falhar, ainda apagamos o registro.
          console.warn("[DELETE song] falha ao remover do R2", key, e);
        }
      }),
    );

    // Cascade no banco remove stems, itens de setlist e comentários.
    await db.delete(songs).where(eq(songs.id, songId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/songs/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
