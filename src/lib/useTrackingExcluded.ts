"use client";

/**
 * Decide se ESTE acesso deve ser medido (GA4, Pixel do TikTok, qualquer outro).
 *
 * Existia uma falha nas travas originais (ver components/Analytics): todas
 * dependiam da sessão — role "admin" ou conta de teste interno. Só que o dono
 * do site navega deslogado o tempo todo: janela anônima, outro navegador,
 * conferindo como o visitante vê. Nesses acessos não há sessão nenhuma, então
 * nenhuma trava pegava e o próprio dono entrava na contagem como visitante.
 * Foi o que apareceu em 15/08/2026: sessão de 17min em /en/privacy e numa
 * página de música, vinda de Minas Gerais, com "recorrentes: 2".
 *
 * A correção é uma trava por DISPOSITIVO, que sobrevive ao logout:
 *
 *  - Assim que alguém entra como admin (ou conta de teste) neste navegador,
 *    gravamos a marca em localStorage. Dali em diante aquele navegador não é
 *    mais medido, logado ou não.
 *  - `?notrack=1` liga a marca manualmente — serve para janela anônima e para
 *    navegador onde você nunca fez login (a marca some ao fechar a anônima,
 *    então lá é preciso repetir).
 *  - `?notrack=0` desliga, para conferir que a medição volta a funcionar.
 *
 * Enquanto a marca não foi lida (primeiro render), nada é medido — melhor
 * perder um page_view do que registrar o dono do site.
 */
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const FLAG = "bts_notrack";

/** Só mede em produção de verdade: nem `npm run dev`, nem preview de branch. */
const IS_LIVE =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production") === "production";

export function useTrackingExcluded(): boolean {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Começa em `null` (indefinido) e nunca mede antes de resolver, para não
  // haver janela em que o script sobe antes de sabermos quem é.
  const [deviceOptOut, setDeviceOptOut] = useState<boolean | null>(null);

  const isAdminArea = pathname?.startsWith("/admin") ?? false;
  const isAdminUser = session?.user?.role === "admin";
  const isTestAccount = session?.user?.isInternalTester === true;

  // Lido do window, não via useSearchParams: esse hook obrigaria um limite de
  // Suspense no layout raiz (onde este componente vive) e derrubaria o build.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const manual = new URLSearchParams(window.location.search).get("notrack");

    try {
      if (manual === "1") localStorage.setItem(FLAG, "1");
      if (manual === "0") localStorage.removeItem(FLAG);

      // Login de admin/teste marca o navegador inteiro, de forma permanente.
      if (isAdminUser || isTestAccount) localStorage.setItem(FLAG, "1");

      setDeviceOptOut(localStorage.getItem(FLAG) === "1");
    } catch {
      // localStorage bloqueado (modo restrito): assume não-medição, que é o
      // lado seguro deste trade-off.
      setDeviceOptOut(true);
    }
  }, [pathname, isAdminUser, isTestAccount]);

  return (
    !IS_LIVE ||
    isAdminArea ||
    isAdminUser ||
    isTestAccount ||
    status === "loading" ||
    deviceOptOut !== false
  );
}
