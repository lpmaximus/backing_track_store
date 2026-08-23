import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import EstudioContent from "./EstudioContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um "use client" — senão o bundler leva neon() para o browser. A parte
// interativa fica isolada em EstudioContent.
export default function EstudioPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <EstudioContent />
      <SiteFooter />
    </div>
  );
}
