import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

export const metadata: Metadata = {
  title: "Como funciona — BackingTrack.store",
  description: "Do catálogo à separação de instrumentos por IA, do ensaio ao palco: veja como o backingtrack.store funciona.",
};

const STEPS = [
  {
    number: "01",
    title: "Encontre ou envie sua música",
    text: "Explore o catálogo de backing tracks com cifra sincronizada, ou envie o áudio de uma gravação sua para que a inteligência artificial separe os instrumentos por você.",
  },
  {
    number: "02",
    title: "Toque com controle total",
    text: "Ajuste velocidade, tonalidade (pitch shift) e faça loop de um trecho difícil, com a cifra rolando em tempo real junto com o áudio.",
  },
  {
    number: "03",
    title: "Pratique por instrumento",
    text: "Nos planos pagos, isole ou silencie cada stem — bateria, baixo, guitarra e mais — para focar só na sua parte.",
  },
  {
    number: "04",
    title: "Leve para o ensaio e o palco",
    text: "Monte setlists com sua banda, corrija a cifra em conjunto e use o Modo Performance para tocar sem distrações durante o show.",
  },
];

const FEATURES = [
  {
    icon: "🎼",
    title: "Catálogo com cifra sincronizada",
    text: "Backing tracks prontos, com a cifra avançando junto com a música em tempo real — sem precisar contar compasso.",
  },
  {
    icon: "🎛️",
    title: "Player profissional",
    text: "Velocidade ajustável, pitch shift (mude o tom sem alterar a velocidade) e loop de trechos A-B para repetir a parte que você está estudando.",
  },
  {
    icon: "🤖",
    title: "Separação de instrumentos por IA",
    text: "Envie um áudio próprio e nossas Ferramentas de IA separam a gravação em stems por instrumento, além de apoiar a detecção de acordes, tom e andamento.",
  },
  {
    icon: "📚",
    title: "Catálogo compartilhado",
    text: "Uma vez processada, uma música fica disponível para outros assinantes pagos — evitando reprocessamento e reduzindo o custo do serviço para todo mundo.",
  },
  {
    icon: "🎙️",
    title: "Grave o seu take",
    text: "Grave sua própria performance por cima da base (overdub) direto pelo navegador. Fica privada por padrão — você decide se compartilha com a banda ou publica.",
  },
  {
    icon: "🎸",
    title: "Bandas e setlists",
    text: "Crie uma banda, convide integrantes, monte setlists compartilhadas e deixe a comunidade sugerir correções de cifra antes do show.",
  },
];

export default function ComoFuncionaPage() {
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
              ● COMO FUNCIONA
            </span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.15, margin: "0 0 20px", color: "var(--text)", letterSpacing: "-0.02em" }}>
            Do catálogo ao palco, <span style={{ color: "var(--accent)" }}>em quatro passos</span>.
          </h1>
          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.7, margin: "0 auto", maxWidth: 620 }}>
            Backing tracks, separação de instrumentos por inteligência artificial e ferramentas de banda,
            tudo em um único player pensado para quem toca — não para quem só ouve.
          </p>
        </section>

        {/* PASSOS */}
        <section style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 56px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {STEPS.map(({ number, title, text }) => (
              <div key={number} style={{
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
                padding: "24px 22px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.08em", marginBottom: 10 }}>
                  {number}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>{title}</div>
                <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* RECURSOS */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 56px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 20px", textAlign: "center" }}>
            O que está por trás
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {FEATURES.map(({ icon, title, text }) => (
              <div key={title} style={{
                display: "flex", gap: 14, padding: "22px 24px",
                border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--border2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)", marginBottom: 5 }}>{title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NOTA SOBRE IA E DIREITOS */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
          <div style={{ background: "var(--surface2)", borderRadius: 16, padding: "22px 26px" }}>
            <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.75, margin: 0 }}>
              A separação por IA é uma tecnologia em evolução e pode conter imprecisões — trate o resultado
              como referência de estudo, e conte com a comunidade para corrigir a cifra quando necessário.
              Você só deve enviar áudio sobre o qual tenha os direitos ou autorização necessária; respeitamos
              notificações de titulares de direitos autorais conforme nossos{" "}
              <Link href="/termos" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>
                Termos de Uso
              </Link>
              .
            </p>
          </div>
        </section>

        {/* CTA */}
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px", textAlign: "center" }}>
          <div style={{
            background: "linear-gradient(135deg, #ffffff 0%, #fff4e0 100%)",
            border: "1px solid rgba(255,154,0,0.25)", borderRadius: 20, padding: "36px 44px",
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", margin: "0 0 10px" }}>
              Pronto para experimentar?
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 14.5, margin: "0 0 20px" }}>
              O catálogo está livre durante o beta — sem cadastro obrigatório para explorar.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/catalogo" className="btn-primary">Explorar músicas</Link>
              <span className="btn-ghost" title="Em breve" style={{ cursor: "default", opacity: 0.6 }}>Ver planos</span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
