/**
 * /api/admin/audio  (R3 / ADR-BTS-003)
 *   GET    → lista o catálogo (admin + uploads de usuário) com status de
 *            moderação. Filtro opcional ?status=approved|pending|blocked.
 *   PATCH  → { songId, moderationStatus } — aprovar/bloquear sem apagar.
 *   DELETE → ?id= — remove do banco (takedown definitivo). O cascade apaga os
 *            stems; a limpeza dos objetos no R2 é follow-up (ver nota).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs, stems, users } from "@/src/db";
import { desc, eq, sql } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";

const VALID = ["approved", "pending", "blocked"];

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");

  try {
    const rows = await db
      .select({
        id: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        sourceType: songs.sourceType,
        uploaderEmail: users.email,
        moderationStatus: songs.moderationStatus,
        processingStatus: songs.processingStatus,
        published: songs.published,
        shared: songs.shared,
        createdAt: songs.createdAt,
        stemCount: sql<number>`count(${stems.id})::int`,
      })
      .from(songs)
      .leftJoin(users, eq(songs.uploadedByUserId, users.id))
      .leftJoin(stems, eq(stems.songId, songs.id))
      .groupBy(songs.id, users.email)
      .orderBy(desc(songs.createdAt));

    const list = status && VALID.includes(status) ? rows.filter((r) => r.moderationStatus === status) : rows;
    return NextResponse.json({ songs: list });
  } catch (err) {
    console.error("[GET /api/admin/audio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { songId, moderationStatus } = (await req.json()) as { songId?: number; moderationStatus?: string };
    if (!songId || !moderationStatus || !VALID.includes(moderationStatus)) {
      return NextResponse.json({ error: "songId e moderationStatus válidos obrigatórios" }, { status: 400 });
    }
    await db.update(songs).set({ moderationStatus, updatedAt: new Date() }).where(eq(songs.id, Number(songId)));
    return NextResponse.json({ ok: true, moderationStatus });
  } catch (err) {
    console.error("[PATCH /api/admin/audio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    // NOTA: remove do banco (cascade apaga stems). Limpeza dos objetos no R2
    // (áudio/stems) fica como follow-up — exige listar as keys e deletar via S3.
    await db.delete(songs).where(eq(songs.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/audio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
