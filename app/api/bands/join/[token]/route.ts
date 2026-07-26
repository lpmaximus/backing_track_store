/**
 * POST /api/bands/join/:token  (Fase 1.5, Frente E)
 * Usuário autenticado aceita um convite: vincula seu userId ao band_member
 * e ativa a participação.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, bands, bandMembers, users } from "@/src/db";
import { and, eq, ne } from "drizzle-orm";
import { MAX_BAND_MEMBERS } from "@/src/lib/bands";
import { createNotification } from "@/src/lib/notifications";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token inválido" }, { status: 400 });

  try {
    const [invite] = await db.select().from(bandMembers).where(eq(bandMembers.inviteToken, token)).limit(1);
    if (!invite) return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 404 });

    const userId = Number(session.user.id);

    // Já é membro ativo desta banda? (aceitou de outro convite)
    const [already] = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, invite.bandId), eq(bandMembers.userId, userId), eq(bandMembers.status, "active")))
      .limit(1);
    if (already) {
      const [band] = await db.select().from(bands).where(eq(bands.id, invite.bandId)).limit(1);
      return NextResponse.json({ band, alreadyMember: true });
    }

    if (invite.status === "active") {
      return NextResponse.json({ error: "Convite já utilizado" }, { status: 409 });
    }

    // Teto de integrantes (líder + 5). A contagem inclui o líder.
    const activeMembers = await db
      .select({ id: bandMembers.id })
      .from(bandMembers)
      .where(and(eq(bandMembers.bandId, invite.bandId), eq(bandMembers.status, "active")));
    if (activeMembers.length >= MAX_BAND_MEMBERS) {
      return NextResponse.json(
        { error: `Banda cheia — o limite é de ${MAX_BAND_MEMBERS} integrantes.` },
        { status: 409 },
      );
    }

    await db
      .update(bandMembers)
      .set({ userId, status: "active", joinedAt: new Date(), inviteToken: null })
      .where(eq(bandMembers.id, invite.id));

    const [band] = await db.select().from(bands).where(eq(bands.id, invite.bandId)).limit(1);

    // Área do Usuário: avisa quem já estava na banda (líder + demais ativos)
    // que um novo integrante entrou. Best-effort — não bloqueia a resposta.
    try {
      const [joined] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      const joinedName = joined?.name ?? joined?.email ?? "Um integrante";
      const others = await db
        .select({ userId: bandMembers.userId })
        .from(bandMembers)
        .where(and(eq(bandMembers.bandId, invite.bandId), eq(bandMembers.status, "active"), ne(bandMembers.userId, userId)));
      await Promise.all(
        others
          .filter((m) => m.userId !== null)
          .map((m) =>
            createNotification({
              userId: m.userId as number,
              type: "band",
              title: "Novo integrante na banda",
              body: `${joinedName} entrou em ${band?.name ?? "sua banda"}.`,
              link: `/bandas`,
            }),
          ),
      );
    } catch (notifyErr) {
      console.error("[POST /api/bands/join/:token] notify", notifyErr);
    }

    return NextResponse.json({ band });
  } catch (err) {
    console.error("[POST /api/bands/join/:token]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
