import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "BackingTrack.store — Cifras e Bases para Musicos",
  description: "Bases musicais profissionais com cifras interativas para musicos amadores e profissionais.",
  other: {
    "google-adsense-account": "ca-pub-2626036835425131",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-K9WC5H9H38"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-K9WC5H9H38');
          `}
        </Script>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
