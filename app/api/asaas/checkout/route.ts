import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, users, subscriptions } from "@/src/db";
import { eq } from "drizzle-orm";
import { findOrCreateCustomer, createSubscription, getSubscriptionPaymentLink } from "@/src/lib/asaas";

// Precos em R$
const PLANS = {
  monthly: { value: 19.90, cycle: "MONTHLY" as const, label: "Pro Mensal" },
  yearly:  { value: 149.00, cycle: "YEARLY"  as const, label: "Pro Anual"  },
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  try {
    const { plan = "monthly", billingType = "PIX" } = await req.json() as {
      plan?: "monthly" | "yearly";
      billingType?: "PIX" | "BOLETO" | "CREDIT_CARD";
    };

    const planConfig = PLANS[plan];
    const userId = Number(session.user.id);

    // Buscar user no banco
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });

    // Criar/buscar cliente no Asaas
    const customer = await findOrCreateCustomer({
      name: user.name ?? user.email,
      email: user.email,
    });

    // Salvar asaasCustomerId no user
    await db.update(users).set({ asaasCustomerId: customer.id }).where(eq(users.id, userId));

    // Criar assinatura com trial de 7 dias
    const subscription = await createSubscription({
      customerId: customer.id,
      billingType,
      value: planConfig.value,
      cycle: planConfig.cycle,
      description: `BackingTrack.store — ${planConfig.label}`,
      externalReference: `user:${userId}`,
    });

    // Salvar assinatura no banco
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    await db.insert(subscriptions).values({
      userId,
      asaasCustomerId: customer.id,
      asaasSubscriptionId: subscription.id,
      status: "trialing",
      trialEnd,
    }).onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        asaasCustomerId: customer.id,
        asaasSubscriptionId: subscription.id,
        status: "trialing",
        trialEnd,
        updatedAt: new Date(),
      },
    });

    // Buscar link de pagamento
    await new Promise(r => setTimeout(r, 1000)); // Asaas precisa de um instante para gerar
    const paymentLink = await getSubscriptionPaymentLink(subscription.id);

    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      paymentLink,
      trialDays: 7,
    });

  } catch (err) {
    console.error("[POST /api/asaas/checkout]", err);
    return NextResponse.json({ error: "Erro ao criar assinatura" }, { status: 500 });
  }
}
