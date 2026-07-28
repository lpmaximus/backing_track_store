/**
 * Cliente mínimo da Google Analytics Data API (GA4), sem dependências novas.
 *
 * Autentica com uma Service Account via JWT self-signed (RS256) trocado por
 * access token no endpoint OAuth do Google. Evita puxar `@google-analytics/data`
 * (gRPC, ~30MB) para dentro do bundle serverless.
 *
 * Env vars necessárias:
 *   GA4_PROPERTY_ID   → ID numérico da propriedade (Admin → Detalhes da propriedade)
 *   GA4_CLIENT_EMAIL  → client_email do JSON da service account
 *   GA4_PRIVATE_KEY   → private_key do JSON (com \n escapados ou reais)
 */
import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API = "https://analyticsdata.googleapis.com/v1beta";

export type GaRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
export type GaReport = { rows?: GaRow[]; rowCount?: number };

export function ga4Configured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID && process.env.GA4_CLIENT_EMAIL && process.env.GA4_PRIVATE_KEY);
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Cache do token em escopo de módulo — sobrevive entre invocações na mesma
// instância lambda e evita um round-trip OAuth por request.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const clientEmail = process.env.GA4_CLIENT_EMAIL!;
  const privateKey = (process.env.GA4_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, exp: now + 3600, iat: now }),
  );
  const signature = base64url(crypto.createSign("RSA-SHA256").update(`${header}.${claim}`).sign(privateKey));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`OAuth GA4 falhou (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in };
  return json.access_token;
}

async function call<T>(method: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API}/properties/${process.env.GA4_PROPERTY_ID}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GA4 ${method} falhou (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

type ReportSpec = {
  dimensions?: string[];
  metrics: string[];
  startDate: string;
  endDate: string;
  orderByMetric?: string;
  limit?: number;
  /**
   * Descarta linhas cuja dimensão começa com este prefixo — usado para tirar
   * `/admin` dos rankings de página. Só afeta dados JÁ coletados; a coleta em
   * si é bloqueada em components/Analytics.tsx.
   */
  excludePrefix?: { dimension: string; value: string };
};

function toRequest(s: ReportSpec) {
  return {
    dateRanges: [{ startDate: s.startDate, endDate: s.endDate }],
    dimensions: (s.dimensions ?? []).map((name) => ({ name })),
    metrics: s.metrics.map((name) => ({ name })),
    ...(s.excludePrefix
      ? {
          dimensionFilter: {
            notExpression: {
              filter: {
                fieldName: s.excludePrefix.dimension,
                stringFilter: { matchType: "BEGINS_WITH", value: s.excludePrefix.value },
              },
            },
          },
        }
      : {}),
    ...(s.orderByMetric
      ? { orderBys: [{ metric: { metricName: s.orderByMetric }, desc: true }] }
      : s.dimensions?.[0] === "date"
        ? { orderBys: [{ dimension: { dimensionName: "date" } }] }
        : {}),
    ...(s.limit ? { limit: String(s.limit) } : {}),
    keepEmptyRows: false,
  };
}

/** Roda até 5 relatórios numa única chamada HTTP. */
export async function batchRunReports(specs: ReportSpec[]): Promise<GaReport[]> {
  const out = await call<{ reports?: GaReport[] }>("batchRunReports", { requests: specs.map(toRequest) });
  return out.reports ?? [];
}

/** Usuários ativos nos últimos 30 minutos. */
export async function runRealtimeActiveUsers(): Promise<number> {
  const out = await call<GaReport>("runRealtimeReport", { metrics: [{ name: "activeUsers" }] });
  return Number(out.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

export const num = (row: GaRow | undefined, i = 0) => Number(row?.metricValues?.[i]?.value ?? 0);
export const dim = (row: GaRow | undefined, i = 0) => row?.dimensionValues?.[i]?.value ?? "";
