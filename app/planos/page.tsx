import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import PlanosContent from "./PlanosContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — senão o bundler leva neon() para o browser
// ("No database connection string was provided to neon()"). A parte interativa
// (useSession, toggle de plano) fica isolada em PlanosContent ("use client").
export default function PlanosPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SiteHeader />
      <PlanosContent />
      <SiteFooter />
    </div>
  );
}
