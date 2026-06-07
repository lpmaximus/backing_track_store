import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import SetlistsContent from "./SetlistsContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — senão o bundler leva neon() para o browser
// ("No database connection string was provided to neon()"). A parte interativa
// (useSession, fetch, formulário) fica isolada em SetlistsContent ("use client").
export default function SetlistsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <SetlistsContent />
      <SiteFooter />
    </div>
  );
}
