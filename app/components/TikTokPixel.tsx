"use client";

/**
 * TikTok Pixel — mesma lógica de exclusão do Analytics.tsx (ver esse arquivo
 * para o porquê de cada trava): nunca mede /admin, usuário admin, conta de
 * teste interno, nem fora de produção real. Sem isso o Pixel aprenderia com
 * o próprio tráfego de quem constrói o site, não com visitantes de anúncio.
 *
 * Pixel criado em 2026-08-15 no TikTok Ads Manager (conta L2techs_adv),
 * ID DA05SBRC77U6N6ARQK0G. Evento de cadastro disparado manualmente em
 * app/[locale]/entrar/page.tsx via window.ttq.track('CompleteRegistration')
 * logo após o /api/auth/register responder OK — cobre apenas cadastro por
 * e-mail/senha; login/cadastro via Google não dispara esse evento ainda
 * (precisaria de sinal server-side de "usuário novo").
 */
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const PIXEL_ID = "DA05SBRC77U6N6ARQK0G";

const IS_LIVE =
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production") === "production";

export default function TikTokPixel() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAdminArea = pathname?.startsWith("/admin") ?? false;
  const isAdminUser = session?.user?.role === "admin";
  const isTestAccount = session?.user?.isInternalTester === true;
  const excluded = !IS_LIVE || isAdminArea || isAdminUser || isTestAccount;

  useEffect(() => {
    if (typeof window === "undefined" || excluded || status === "loading") return;
    const ttq = (window as unknown as { ttq?: { page: () => void } }).ttq;
    ttq?.page();
  }, [pathname, excluded, status]);

  if (excluded) return null;

  return (
    <Script id="tiktok-pixel" strategy="afterInteractive">
      {`
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
          ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

          ttq.load('${PIXEL_ID}');
          ttq.page();
        }(window, document, 'ttq');
      `}
    </Script>
  );
}
