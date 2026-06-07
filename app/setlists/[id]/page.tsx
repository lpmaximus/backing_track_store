import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import SetlistDetailContent from "./SetlistDetailContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado
// por um arquivo "use client" — senão o bundler leva neon() para o browser
// ("No database connection string was provided to neon()"). A parte interativa
// fica isolada em SetlistDetailContent ("use client"), recebendo `id` já resolvido.
export default async function SetlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <SetlistDetailContent id={id} />
      <SiteFooter />
    </div>
  );
}
