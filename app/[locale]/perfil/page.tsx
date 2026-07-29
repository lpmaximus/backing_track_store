import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import PerfilContent from "./PerfilContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — senão o bundler leva neon() para o browser.
// A parte interativa (useSession, fetch, polling) fica isolada em
// PerfilContent ("use client").
export default function PerfilPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <PerfilContent />
      <SiteFooter />
    </div>
  );
}
