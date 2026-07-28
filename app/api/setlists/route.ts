import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs, bands, bandMembers } from "@/src/db";
import { eq, sql, and, or, inArray } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import { roleCan } from "@/src/lib/permissions";
import { track } from "@/src/lib/activity";

// GET /api/setlists — setlists pessoais do usuario + setlists das bandas em que
// ele é membro ativo (Fase 1.5, Frente E).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const userId = Number(session.user.id);

    // Bandas ativas do usuário → suas setlists compartilhadas aparecem na lista.
    const myBands = await db
      .select({ bandId: bandMembers.bandId })
      .from(bandMembers)
      .where(and(eq(bandMembers.userId, userId), eq(bandMembers.status, "active")));
    const bandIds = myBands.map((b) => b.bandId);

    const whereClause = bandIds.length
      ? or(eq(setlists.userId, userId), inArray(setlists.bandId, bandIds))
      : eq(setlists.userId, userId);

    const rows = await db
      .select({
        id: setlists.id,
        name: setlists.name,
        notes: setlists.notes,
        bandId: setlists.bandId,
        bandName: bands.name,
        createdAt: setlists.createdAt,
        updatedAt: setlists.updatedAt,
        songCount: sql<number>`count(${setlistSongs.id})::int`,
      })
      .from(setlists)
      .leftJoin(setlistSongs, eq(setlistSongs.setlistId, setlists.id))
      .leftJoin(bands, eq(bands.id, setlists.bandId))
      .where(whereClause)
      .groupBy(setlists.id, bands.name)
      .orderBy(setlists.updatedAt);

    return NextResponse.json({ setlists: rows.reverse() });
  } catch (err) {
    console.error("[GET /api/setlists]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/setlists — cria nova setlist { name, notes?, bandId? }
// Se bandId vier, exige que o usuário seja o líder daquela banda.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  // Criar setlist pessoal: Pro/ProBand/admin (ADR-BTS-002 §2). Free e FreeBand
  // não criam setlist própria — o membro de banda vê/comenta a setlist da banda
  // (GET usa hasProAccess), mas não cria. Setlist de banda exige ser líder (abaixo).
  if (!roleCan(session.user.role, "create_setlist")) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  try {
    const { name, notes, bandId } = (await req.json()) as { name?: string; notes?: string; bandId?: number };
    if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400 });
    if (name.trim().length > 200) return NextResponse.json({ error: "Nome muito longo" }, { status: 400 });

    const userId = Number(session.user.id);

    let finalBandId: number | null = null;
    if (bandId) {
      const [band] = await db.select().from(bands).where(eq(bands.id, Number(bandId))).limit(1);
      if (!band) return NextResponse.json({ error: "Banda não encontrada" }, { status: 404 });
      if (band.leaderUserId !== userId) {
        return NextResponse.json({ error: "Só o líder cria setlist da banda" }, { status: 403 });
      }
      finalBandId = band.id;
    }

    const [created] = await db
      .insert(setlists)
      .values({ userId, bandId: finalBandId, name: name.trim(), notes: notes?.trim() || null })
      .returning();

    void track(userId, "setlist_create", { meta: { bandId: finalBandId } });

    return NextResponse.json({ setlist: { ...created, songCount: 0 } }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
