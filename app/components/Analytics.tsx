"use client";

/**
 * Google Analytics com exclusão de tráfego interno.
 *
 * Sem isto, cada vez que o dono abre /admin o GA conta uma visita — e o painel
 * de audiência acaba medindo quem o construiu, não o público. As travas (área
 * /admin, role admin, conta de teste interno, ambiente não-produção e a marca
 * por dispositivo que sobrevive ao logout) estão todas em
 * src/lib/useTrackingExcluded — inclusive o porquê de cada uma.
 *
 * Para o caso de o script já ter carregado antes (navegou de / para /admin na
 * mesma sessão), usamos a flag oficial de opt-out `ga-disable-<ID>`, que
 * silencia inclusive os eventos automáticos (scroll, cliques de saída).
 *
 * `send_page_view: false` + disparo manual: é o que permite decidir página a
 * página se aquele acesso conta ou não.
 */
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTrackingExcluded } from "@/src/lib/useTrackingExcluded";

const GA_ID = "G-K9WC5H9H38";

export default function Analytics() {
  const pathname = usePathname();
  const excluded = useTrackingExcluded();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as Record<string, unknown>;

    // Opt-out oficial do GA: desliga qualquer coleta para esta propriedade.
    w[`ga-disable-${GA_ID}`] = excluded;

    if (excluded) return;

    const gtag = w.gtag as ((...args: unknown[]) => void) | undefined;
    if (typeof gtag !== "function") return;

    gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, excluded]);

  if (excluded) return null;

  return (
    <>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
