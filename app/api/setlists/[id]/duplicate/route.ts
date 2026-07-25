/**
 * Duplicar setlist (Fase S2 / ADR-BTS-005).
 *   POST → cria uma cópia do repertório, com a mixagem padrão e o preparo
 *          (tom, velocidade, intervalo) de cada música.
 *
 * O uso real é "Repertório base" → "Show do dia 12": o líder quer o mesmo
 * conjunto de músicas já preparado, para então cortar duas e reordenar.
 *
 * NÃO copia: ensaios, escalação, prontidão, presença, mural nem overrides
 * pessoais de mix. Tudo isso é história daquela ocorrência, não do repertório —
 * levar junto criaria um ensaio fantasma com prontidão que ninguém marcou.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, setlists, setlistSongs, setlistSongMix } from "@/src/db";
import { asc, eq, inArray } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import { resolveSetlistRole, canManageEvent } from "@/src/lib/events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = Number(session.user.id);
  if (!(await hasProAccess(userId, session.user.role))) {
    return NextResponse.json({ error: "Recurso exclusivo do plano Pro" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const setlistId = Number(idParam);
  if (!setlistId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const role = await resolveSetlistRole(setlistId, userId);
  if (role.kind === "notfound") return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });
  if (!canManageEvent(role)) {
    return NextResponse.json({ error: "Só o líder duplica o repertório" }, { status: 403 });
  }

  try {
    const [origin] = await db.select().from(setlists).where(eq(setlists.id, setlistId)).limit(1);
    if (!origin) return NextResponse.json({ error: "Setlist não encontrada" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name?.trim() || `${origin.name} (cópia)`).slice(0, 200);

    const [copy] = await db
      .insert(setlists)
      .values({
        userId, // quem duplicou vira dono da cópia
        bandId: origin.bandId,
        name,
        notes: origin.notes,
      })
      .returning();

    const items = await db
      .select()
      .from(setlistSongs)
      .where(eq(setlistSongs.setlistId, setlistId))
      .orderBy(asc(setlistSongs.position), asc(setlistSongs.id));

    if (items.length === 0) return NextResponse.json({ setlist: copy, songs: 0 }, { status: 201 });

    const created = await db
      .insert(setlistSongs)
      .values(
        items.map((it) => ({
          setlistId: copy.id,
          songId: it.songId,
          position: it.position,
          notes: it.notes,
          transposeSemitones: it.transposeSemitones,
          speed: it.speed,
          gapSeconds: it.gapSeconds,
        })),
      )
      .returning();

    // Mapa item antigo → item novo, pela posição na lista (ambos vieram na
    // mesma ordem), para levar a mixagem padrão junto.
    const oldToNew = new Map<number, number>();
    items.forEach((it, i) => {
      if (created[i]) oldToNew.set(it.id, created[i].id);
    });

    const mixRows = await db
      .select()
      .from(setlistSongMix)
      .where(inArray(setlistSongMix.setlistSongId, items.map((i) => i.id)));

    if (mixRows.length > 0) {
      const toInsert = mixRows
        .map((m) => {
          const target = oldToNew.get(m.setlistSongId);
          return target ? { setlistSongId: target, stemKey: m.stemKey, state: m.state, volume: m.volume } : null;
        })
        .filter((v): v is { setlistSongId: number; stemKey: string; state: string; volume: number } => v !== null);
      if (toInsert.length > 0) await db.insert(setlistSongMix).values(toInsert);
    }

    return NextResponse.json({ setlist: copy, songs: created.length }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/setlists/:id/duplicate]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
