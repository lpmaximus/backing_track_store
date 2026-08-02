import type { Metadata } from "next";
import "./globals.css";
import { getLocale } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import Analytics from "./components/Analytics";
import AdSense from "./components/AdSense";
import { htmlLang, type Locale } from "@/src/i18n/routing";

export const metadata: Metadata = {
  title: "BackingTrack.store — Cifras e Bases para Musicos",
  description:
    "Bases musicais profissionais com cifras interativas para musicos amadores e profissionais.",
  other: {
    "google-adsense-account": "ca-pub-2626036835425131",
  },
};

/**
 * Root layout único da aplicação (vale para /admin também).
 * O idioma vem do request — em /admin, que não é localizado, cai no padrão.
 * O provider de mensagens fica em app/[locale]/layout.tsx.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;

  return (
    <html lang={htmlLang[locale] ?? "pt-BR"} className="h-full">
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <SessionProvider>
          {/* Dentro do SessionProvider: precisa saber se quem navega é admin
              para não medir o próprio dono do site. Ver components/Analytics. */}
          <Analytics />
          {/* Só carrega nas páginas públicas e para quem não é assinante.
              O porquê da lista de permissão está em components/AdSense. */}
          <AdSense />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
