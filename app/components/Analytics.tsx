"use client";

/**
 * Google Analytics com exclusão de tráfego interno.
 *
 * Sem isto, cada vez que o dono abre /admin o GA conta uma visita — e o painel
 * de audiência acaba medindo quem o construiu, não o público. Duas travas:
 *
 *  1. Área /admin nunca é medida (nem o script carrega, se a entrada foi direta).
 *  2. Usuário com role "admin" nunca é medido, em página nenhuma.
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
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const GA_ID = "G-K9WC5H9H38";

export default function Analytics() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAdminArea = pathname?.startsWith("/admin") ?? false;
  const isAdminUser = session?.user?.role === "admin";
  const excluded = isAdminArea || isAdminUser;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as Record<string, unknown>;

    // Opt-out oficial do GA: desliga qualquer coleta para esta propriedade.
    w[`ga-disable-${GA_ID}`] = excluded;

    if (excluded || status === "loading") return;

    const gtag = w.gtag as ((...args: unknown[]) => void) | undefined;
    if (typeof gtag !== "function") return;

    gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, excluded, status]);

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
