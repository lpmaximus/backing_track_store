"use client";

/**
 * Google AdSense (Anúncios automáticos) — carregado SÓ nas páginas públicas.
 *
 * A conta foi aprovada em 02/08/2026 (publisher ca-pub-2626036835425131). A tag
 * de verificação `google-adsense-account` já vive em app/layout.tsx; este
 * componente é o script que efetivamente exibe anúncio.
 *
 * ── Por que uma lista de permissão, e não uma de bloqueio ────────────────────
 *
 * A política do AdSense proíbe veicular anúncio ao lado de material protegido
 * por direito autoral, e "unauthorized filesharing" é uma das causas mais comuns
 * de suspensão. Boa parte deste site é exatamente isso do ponto de vista de um
 * revisor do Google: o usuário envia um fonograma comercial e nós devolvemos os
 * stems separados. Anúncio nessas telas é risco de banimento — e banimento de
 * conta AdSense costuma ser permanente, o que fecharia a porta até para um blog
 * futuro no mesmo domínio.
 *
 * Por isso a regra é ALLOWLIST: só as páginas institucionais e de marketing
 * exibem anúncio. Qualquer rota nova criada daqui pra frente nasce SEM anúncio
 * por padrão — para incluí-la é preciso vir aqui de propósito. O contrário
 * (lista de bloqueio) esqueceria de proteger a próxima rota que alguém criar.
 *
 * ── Limite conhecido ────────────────────────────────────────────────────────
 *
 * Anúncios automáticos injetam no DOM por conta própria. Este gate impede que o
 * script CARREGUE ao entrar por uma rota protegida, mas se o visitante entrar
 * pela home (script carregado) e navegar no client para /song/xxx, o SDK do
 * Google pode tentar injetar lá. A trava definitiva para esse caso é a lista
 * "Páginas excluídas" no painel do AdSense — configurar lá também, com os
 * mesmos caminhos de BLOQUEADAS_NO_PAINEL abaixo. Cinto e suspensório.
 *
 * ── Quem não vê anúncio ─────────────────────────────────────────────────────
 *
 * Assinante pagante (pro/proband) e admin nunca veem. Quem paga não é audiência
 * de anúncio, e medir o próprio dono do site não faz sentido.
 */
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PUBLISHER_ID = "ca-pub-2626036835425131";

/**
 * Kill switch. Para desligar sem mexer em código, criar a env var na Vercel:
 *   NEXT_PUBLIC_ADSENSE_ENABLED=false
 * Ausente = ligado (foi o pedido ao aprovar a conta).
 */
const ENABLED = (process.env.NEXT_PUBLIC_ADSENSE_ENABLED ?? "true") !== "false";

/** Mesma trava do Analytics: nada de anúncio em dev nem em preview de branch. */
const IS_LIVE =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production") === "production";

/**
 * Rotas públicas onde o anúncio é permitido, nas duas línguas (ver
 * src/i18n/routing.ts — o slug muda em inglês, o caminho interno não).
 *
 * Fora desta lista: /upload, /song, /perfil, /conta, /setlists, /bandas,
 * /compartilhadas, /convite, /entrar e /admin.
 */
const ROTAS_COM_ANUNCIO = new Set<string>([
  "/",
  "/catalogo",
  "/catalog",
  "/planos",
  "/pricing",
  "/como-funciona",
  "/how-it-works",
  "/sobre",
  "/about",
  "/contato",
  "/contact",
  "/termos",
  "/terms",
  "/privacidade",
  "/privacy",
  "/cookies",
]);

/** Remove o prefixo /en para comparar sempre o mesmo formato de caminho. */
function semLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}

export default function AdSense() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (!ENABLED || !IS_LIVE) return null;
  if (status === "loading") return null;

  const role = session?.user?.role;
  const pagante = role === "pro" || role === "proband" || role === "admin";
  if (pagante) return null;

  const caminho = semLocale(pathname ?? "/").replace(/\/$/, "") || "/";
  if (!ROTAS_COM_ANUNCIO.has(caminho)) return null;

  return (
    <Script
      id="google-adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`}
    />
  );
}
