/**
 * GET /api/songs/shared  (Fase 1.5)
 *
 * Catálogo compartilhado entre usuários Pro: músicas de user_upload já
 * processadas (processingStatus = "ready"), de qualquer usuário — não só as
 * próprias. Diferente de /api/songs (só published=true, catálogo admin) e de
 * /api/songs/mine (só as do próprio usuário).
 *
 * Não expõe uploadedByUserId nem nenhum outro dado do usuário que enviou —
 * só os metadados da música em si (mesma lógica de privacidade do resto do
 * catálogo). Ver decisão registrada no projeto: catálogo processado fica
 * aberto entre usuários Pro, mas a exposição pública de "quem subiu o quê"
 * fica de fora.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  // Catálogo compartilhado: Pro/ProBand/admin. FreeBand NÃO vê (ADR-BTS-002 §2)
  // — por isso é checagem por role, não hasProAccess (que herda acesso de banda).
  if (!roleCan(session.user.role, "view_shared_catalog")) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  try {
    const conditions = [
      eq(songs.sourceType, "user_upload"),
      eq(songs.processingStatus, "ready"),
      eq(songs.shared, true), // só entram no catálogo as que o dono compartilhou
      ne(songs.moderationStatus, "blocked"), // takedown/disputa oculta do catálogo (R3)
      ne(songs.uploadedByUserId, Number(session.user.id)), // já aparece em "Minhas músicas"
    ];
    if (q) {
      const cond = or(ilike(songs.title, `%${q}%`), ilike(songs.artist, `%${q}%`));
      if (cond) conditions.push(cond);
    }

    const result = await db
      .select({
        id: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        genre: songs.genre,
        key: songs.key,
        bpm: songs.bpm,
        thumbnailUrl: songs.thumbnailUrl,
        createdAt: songs.createdAt,
      })
      .from(songs)
      .where(and(...conditions))
      .orderBy(songs.title);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/songs/shared]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
