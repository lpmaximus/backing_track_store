/**
 * POST /api/bands/:id/invite  (Fase 1.5, Frente E)
 * Líder gera um convite (token). O link é compartilhado manualmente no MVP
 * (sem e-mail transacional). Body: { instrument?, invitedEmail? }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { db, bands, bandMembers } from "@/src/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const bandId = Number(idParam);
  if (!bandId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1);
    if (!band) return NextResponse.json({ error: "Banda não encontrada" }, { status: 404 });
    if (band.leaderUserId !== Number(session.user.id)) {
      return NextResponse.json({ error: "Só o líder pode convidar" }, { status: 403 });
    }

    const { instrument, invitedEmail } = (await req.json().catch(() => ({}))) as {
      instrument?: string;
      invitedEmail?: string;
    };

    const token = randomBytes(24).toString("hex");
    const [member] = await db
      .insert(bandMembers)
      .values({
        bandId,
        inviteToken: token,
        invitedEmail: invitedEmail?.trim() || null,
        instrument: instrument?.trim() || null,
        status: "invited",
      })
      .returning();

    return NextResponse.json({ member, token, path: `/bandas/entrar/${token}` }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bands/:id/invite]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
