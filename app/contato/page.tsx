import type { Metadata } from "next";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import ContatoForm from "./ContatoForm";

export const metadata: Metadata = {
  title: "Contato — BackingTrack.store",
  description: "Fale com a equipe do backingtrack.store.",
};

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — a parte interativa (o formulário) fica
// isolada em ContatoForm ("use client"), como em Planos e Perfil.
export default function ContatoPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "56px 24px 80px", width: "100%" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>
          Fale conosco
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.7, margin: "0 0 32px", maxWidth: 520 }}>
          Dúvidas, sugestões ou problemas com o Serviço? Preencha o formulário abaixo — ele abre seu
          aplicativo de e-mail com a mensagem já preenchida para{" "}
          <a href="mailto:contato@l2techs.com" style={{ textDecoration: "underline", color: "var(--accent)", fontWeight: 600 }}>
            contato@l2techs.com
          </a>
          .
        </p>

        <ContatoForm />
      </div>

      <SiteFooter />
    </div>
  );
}
