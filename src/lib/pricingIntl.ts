/**
 * Preço público por moeda (ADR-BTS-006).
 *
 * Fonte única para o que aparece na home e em /planos — hoje os dois divergem
 * (home mostra R$29/R$49, /planos mostra R$19,90). Qualquer tela deve ler daqui.
 *
 * O preço em USD NÃO é conversão do real. É posicionamento: o mercado de fora
 * compara com Moises/Karaoke Version, cujos planos ficam na faixa de US$4-10/mês.
 * Converter R$19,90 daria ~US$3,60 e sinalizaria produto barato demais; por
 * outro lado, cobrar o preço americano no Brasil mataria a conversão local.
 * Por isso: paridade de poder de compra, não paridade cambial.
 */
import type { Locale } from "@/src/i18n/routing";

export type Currency = "BRL" | "USD";
export type PlanId = "free" | "pro" | "band" | "studio";
export type Cycle = "monthly" | "yearly";

/**
 * Durante o beta os valores ainda não estão fechados, então saem borrados na
 * tela. Para revelar: mude para `false` (um lugar só — home e /planos leem daqui).
 *
 * ATENÇÃO: é ocultação VISUAL. O número continua no HTML, no "ver código-fonte"
 * e num screenshot com filtro. Se a exigência for que ninguém consiga ver o
 * valor de jeito nenhum, o caminho é não renderizar o preço — diga que eu troco.
 */
export const PRICES_BLURRED = true;

/** Moeda pela língua da interface (que já vem do país — ver src/i18n/geo.ts). */
export function currencyForLocale(locale: Locale): Currency {
  return locale === "pt" ? "BRL" : "USD";
}

/** Valores em unidade principal (reais / dólares). */
export const PRICE_TABLE: Record<Currency, Record<PlanId, Record<Cycle, number>>> = {
  BRL: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 19.9, yearly: 149 },
    band: { monthly: 59.9, yearly: 449 },
    studio: { monthly: 89.9, yearly: 669 },
  },
  USD: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 7.9, yearly: 59 },
    band: { monthly: 19.9, yearly: 149 },
    studio: { monthly: 29.9, yearly: 225 },
  },
};

/**
 * De onde veio o preço do studio (EVT-004 §5.3) — e o que ainda não foi testado.
 *
 * Faixa recomendada no estudo: R$79,90-89,90 para o v1. Ficou no topo porque o
 * v1 já entra com Guitar Tab, que nenhum concorrente combina com separação de
 * stems. Referência de sanidade: assinar Moises + Songsterr + BandLab Pro
 * separado dá ~R$150-200/mês, então R$89,90 continua sendo desconto real.
 *
 * O anual segue os mesmos ~38% dos outros planos (89,90 × 12 = 1.078,80 → 669).
 *
 * RESSALVA: é benchmark de concorrente, não teste com cliente. O EVT-004 pede
 * validar com as primeiras bandas antes de publicar — e `PRICES_BLURRED` acima
 * ainda está ligado, então nada disso aparece na tela hoje.
 */

const LOCALE_TAG: Record<Currency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
};

export function formatPrice(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE_TAG[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function getPrice(plan: PlanId, cycle: Cycle, locale: Locale) {
  const currency = currencyForLocale(locale);
  const value = PRICE_TABLE[currency][plan][cycle];
  return { value, currency, formatted: formatPrice(value, currency) };
}

/** Economia do plano anual frente a 12x o mensal. */
export function getYearlySavings(plan: PlanId, locale: Locale) {
  const currency = currencyForLocale(locale);
  const { monthly, yearly } = PRICE_TABLE[currency][plan];
  const value = Math.max(0, monthly * 12 - yearly);
  return { value, currency, formatted: formatPrice(value, currency) };
}

/**
 * Meio de pagamento disponível por moeda.
 *
 * BRL → Asaas (PIX, boleto, cartão). Exige CPF/CNPJ, não atende cartão
 *       internacional e liquida só em conta brasileira.
 * USD → Stripe. É o gateway que aceita cartão internacional; a alternativa
 *       Paddle atua como merchant of record e resolve sales tax/VAT por conta
 *       própria — ver ADR-BTS-006 §5 antes de fechar.
 */
export function gatewayForCurrency(currency: Currency): "asaas" | "stripe" {
  return currency === "BRL" ? "asaas" : "stripe";
}
