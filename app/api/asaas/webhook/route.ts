import { NextRequest, NextResponse } from "next/server";
import { db, users, subscriptions } from "@/src/db";
import { eq } from "drizzle-orm";

// Eventos que ativam Pro
const PRO_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

// Eventos que cancelam Pro
const CANCEL_EVENTS = new Set([
  "SUBSCRIPTION_DELETED",
  "PAYMENT_DELETED",
]);

export async function POST(req: NextRequest) {
  try {
    // Validar token do webhook (configure no painel Asaas)
    const token = req.headers.get("asaas-access-token");
    if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = await req.json() as {
      event: string;
      payment?: {
        subscription?: string;
        externalReference?: string;
        status?: string;
        value?: number;
        billingType?: string;
        dueDate?: string;
      };
      subscription?: {
        id?: string;
        externalReference?: string;
        status?: string;
      };
    };

    console.log("[Asaas webhook]", event.event, event.payment?.subscription ?? event.subscription?.id);

    // Extrair referencia externa (user:ID)
    const externalRef = event.payment?.externalReference ?? event.subscription?.externalReference ?? "";
    const userId = externalRef.startsWith("user:") ? Number(externalRef.split(":")[1]) : null;
    const subscriptionId = event.payment?.subscription ?? event.subscription?.id;

    if (!userId) {
      return NextResponse.json({ ok: true, skipped: "no externalReference" });
    }

    if (PRO_EVENTS.has(event.event)) {
      // Ativar Pro
      await db.update(users).set({ role: "pro", updatedAt: new Date() }).where(eq(users.id, userId));
      if (subscriptionId) {
        await db.update(subscriptions)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(subscriptions.asaasSubscriptionId, subscriptionId));
      }
      console.log(`[Asaas] User ${userId} → Pro ativo`);
    }

    if (CANCEL_EVENTS.has(event.event)) {
      // Cancelar Pro
      await db.update(users).set({ role: "free", updatedAt: new Date() }).where(eq(users.id, userId));
      if (subscriptionId) {
        await db.update(subscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(subscriptions.asaasSubscriptionId, subscriptionId));
      }
      console.log(`[Asaas] User ${userId} → Free (cancelado)`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Asaas webhook error]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
