"use client";

/**
 * Google Analytics com exclusão de tráfego interno.
 *
 * Sem isto, cada vez que o dono abre /admin o GA conta uma visita — e o painel
 * de audiência acaba medindo quem o construiu, não o público. Quatro travas:
 *
 *  1. Área /admin nunca é medida (nem o script carrega, se a entrada foi direta)
 *     — cobre qualquer consulta de manutenção, de qualquer conta.
 *  2. Usuário com role "admin" nunca é medido, em página nenhuma do site.
 *  3. Conta marcada como teste interno (ver src/lib/internalTest.ts) também não
 *     — existe porque a conta usada para testar como usuário comum
 *     (lpmax.geek@gmail.com) precisa manter role normal para o teste valer,
 *     então não cai na trava 2. Só um booleano chega ao navegador, nunca o e-mail.
 *  4. Só mede em produção de verdade — nem `npm run dev`, nem deploy de preview.
 *     Sem esta trava, testar o site no localhost deslogado (ou em janela anônima,
 *     onde não há role de admin) polui o painel com o próprio desenvolvimento:
 *     foi o que aconteceu em 28/07/2026, com /en/bands e /en/setlists aparecendo
 *     entre as páginas mais vistas logo depois de um dia de testes.
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

/**
 * Mede apenas no ambiente de produção. NEXT_PUBLIC_VERCEL_ENV vale "production",
 * "preview" ou "development" na Vercel; no localhost ela não existe, e o
 * NODE_ENV resolve o caso. As duas condições juntas cobrem dev local, preview
 * de branch e produção.
 */
const IS_LIVE =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production") === "production";

export default function Analytics() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAdminArea = pathname?.startsWith("/admin") ?? false;
  const isAdminUser = session?.user?.role === "admin";
  const isTestAccount = session?.user?.isInternalTester === true;
  const excluded = !IS_LIVE || isAdminArea || isAdminUser || isTestAccount;

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
