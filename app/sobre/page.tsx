import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

export const metadata: Metadata = {
  title: "Sobre nós — BackingTrack.store",
  description: "A missão, os valores e a equipe por trás do backingtrack.store.",
};

const VALUES = [
  {
    icon: "🎧",
    title: "Feito para quem toca",
    text: "Cada recurso nasce de uma necessidade real de quem pratica, ensaia e se apresenta — não de quem só ouve música.",
  },
  {
    icon: "🤝",
    title: "Comunidade corrige a cifra",
    text: "Nenhuma cifra é perfeita na primeira vez. Deixamos a própria comunidade de músicos sugerir e validar correções.",
  },
  {
    icon: "⚖️",
    title: "Respeito a direitos autorais",
    text: "Trabalhamos com um catálogo compartilhado entre assinantes, mas levamos a sério as notificações de titulares de direitos — com política clara de notificação e retirada.",
  },
  {
    icon: "🔒",
    title: "Sua gravação é sua",
    text: "O que você grava fica privado por padrão. Nunca usamos seu conteúdo para treinar modelos de IA sem autorização explícita.",
  },
];

export default function SobrePage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main>
        {/* HERO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 32px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,154,0,0.12)", border: "1px solid rgba(255,154,0,0.3)",
            borderRadius: 500, padding: "6px 14px", marginBottom: 24,
          }}>
            <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>
              ● SOBRE NÓS
            </span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: "0 0 20px", color: "var(--text)", letterSpacing: "-0.02em" }}>
            Conectando músicos<br />através da música.
          </h1>
          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, margin: "0 auto", maxWidth: 620 }}>
            O backingtrack.store nasceu de um problema simples: praticar ou se apresentar com uma boa base
            instrumental e cifra sincronizada sempre exigia juntar vídeo do YouTube, cifra de um site, tuner
            de outro e horas separando faixas &quot;no ouvido&quot;. Reunimos tudo isso — e a inteligência artificial
            para fazer a separação de instrumentos por você.
          </p>
        </section>

        {/* MISSÃO / PRODUTO */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 56px" }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
            padding: "40px 44px",
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 16px" }}>
              O que fazemos
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.85, margin: "0 0 16px" }}>
              Somos uma plataforma de prática musical: um catálogo de backing tracks com cifra sincronizada
              em tempo real, um player profissional com controle de velocidade, tonalidade e loop de
              trechos, e ferramentas de inteligência artificial que separam qualquer áudio que você envie
              em faixas por instrumento (stems) — bateria, baixo, guitarra e mais.
            </p>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              Para bandas, oferecemos setlists compartilhadas, correção de cifra pela comunidade e um Modo
              Performance pensado para ensaio e palco.
            </p>
          </div>
        </section>

        {/* VALORES */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 20px", textAlign: "center" }}>
            O que nos guia
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {VALUES.map(({ icon, title, text }) => (
              <div key={title} style={{
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
                padding: "24px 22px",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14,
                }}>
                  {icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>{title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* QUEM OPERA */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
          <div style={{
            border: "1px solid var(--border)", borderRadius: 20, padding: "32px 36px",
          }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>
              Quem opera o backingtrack.store
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7, margin: "0 0 20px" }}>
              O backingtrack.store é operado pela L2techs, sediada em Belo Horizonte — MG. Toda a política
              de privacidade, termos de uso e tratamento de direitos autorais está detalhada nas páginas
              legais do site.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/contato" className="btn-primary">Fale conosco</Link>
              <Link href="/termos" className="btn-ghost">Termos de Uso</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
