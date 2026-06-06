// Cliente Asaas API
// Docs: https://docs.asaas.com

const ASAAS_URL = process.env.ASAAS_API_URL ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY = process.env.ASAAS_API_KEY ?? "";

async function asaas<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    method,
    headers: {
      "access_token": ASAAS_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json() as T;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasSubscription {
  id: string;
  status: string;
  value: number;
  nextDueDate: string;
  billingType: string;
  paymentLink?: string;
}

export interface AsaasPaymentLink {
  id: string;
  url: string;
  invoiceUrl?: string;
}

// Cria ou busca cliente pelo email
export async function findOrCreateCustomer(data: {
  name: string;
  email: string;
  cpfCnpj?: string;
}): Promise<AsaasCustomer> {
  // Buscar por email primeiro
  const list = await asaas<{ data: AsaasCustomer[] }>("GET", `/customers?email=${encodeURIComponent(data.email)}&limit=1`);
  if (list.data.length > 0) return list.data[0];
  return asaas<AsaasCustomer>("POST", "/customers", data);
}

// Cria assinatura com trial de 7 dias
export async function createSubscription(data: {
  customerId: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  description: string;
  externalReference?: string;
}): Promise<AsaasSubscription> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  const nextDueDate = trialEnd.toISOString().split("T")[0];

  return asaas<AsaasSubscription>("POST", "/subscriptions", {
    customer: data.customerId,
    billingType: data.billingType,
    value: data.value,
    nextDueDate,
    cycle: data.cycle,
    description: data.description,
    externalReference: data.externalReference,
    // 7 dias gratis — cobranca so na primeira data
    fine: { value: 1 },
    interest: { value: 1 },
  });
}

// Busca link de pagamento da primeira cobranca da assinatura
export async function getSubscriptionPaymentLink(subscriptionId: string): Promise<string | null> {
  try {
    const payments = await asaas<{ data: Array<{ invoiceUrl?: string; bankSlipUrl?: string; status: string }> }>(
      "GET", `/subscriptions/${subscriptionId}/payments?limit=1`
    );
    const p = payments.data[0];
    return p?.invoiceUrl ?? p?.bankSlipUrl ?? null;
  } catch {
    return null;
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await asaas("DELETE", `/subscriptions/${subscriptionId}`);
}
