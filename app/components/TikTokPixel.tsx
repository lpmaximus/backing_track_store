"use client";

/**
 * TikTok Pixel — usa exatamente as mesmas travas de exclusão do GA4
 * (src/lib/useTrackingExcluded), incluindo a marca por dispositivo que impede
 * o dono do site de ser medido quando navega deslogado. Sem isso o Pixel
 * aprenderia com o tráfego de quem constrói o site, não com o visitante que
 * chegou pelo anúncio — e a otimização da campanha iria atrás do público errado.
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
import { useEffect } from "react";
import { useTrackingExcluded } from "@/src/lib/useTrackingExcluded";

const PIXEL_ID = "DA05SBRC77U6N6ARQK0G";

export default function TikTokPixel() {
  const pathname = usePathname();
  const excluded = useTrackingExcluded();

  useEffect(() => {
    if (typeof window === "undefined" || excluded) return;
    const ttq = (window as unknown as { ttq?: { page: () => void } }).ttq;
    ttq?.page();
  }, [pathname, excluded]);

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
