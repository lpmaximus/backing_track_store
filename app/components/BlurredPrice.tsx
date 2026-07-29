import type { CSSProperties, ReactNode } from "react";
import { PRICES_BLURRED } from "@/src/lib/pricingIntl";

/**
 * Esconde o valor atrás de um desfoque enquanto os preços não estão fechados.
 * Liga/desliga em src/lib/pricingIntl.ts → PRICES_BLURRED.
 *
 * `select: none` evita o copiar-e-colar acidental, e `aria-hidden` impede que
 * um leitor de tela anuncie um número que a tela não está mostrando — nesse
 * caso quem usa leitor ouve só o texto alternativo.
 */
export default function BlurredPrice({
  children,
  srLabel,
  style,
}: {
  children: ReactNode;
  /** O que o leitor de tela anuncia no lugar do valor. */
  srLabel: string;
  style?: CSSProperties;
}) {
  if (!PRICES_BLURRED) return <>{children}</>;

  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <span
        aria-hidden="true"
        style={{
          filter: "blur(11px)",
          WebkitFilter: "blur(11px)",
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
          display: "inline-block",
          opacity: 0.85,
        }}
      >
        {children}
      </span>
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}
