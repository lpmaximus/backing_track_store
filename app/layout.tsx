import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Analytics from "./components/Analytics";

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
        <SessionProvider>
          {/* Dentro do SessionProvider: precisa saber se quem navega é admin
              para não medir o próprio dono do site. Ver components/Analytics. */}
          <Analytics />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
