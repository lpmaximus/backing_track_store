import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import EventDetailContent from "./EventDetailContent";

// Server Component: SiteHeader usa auth()/db (Neon) e NÃO pode ser importado por
// um arquivo "use client". A parte interativa fica em EventDetailContent.
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id, eventId } = await params;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <EventDetailContent setlistId={id} eventId={eventId} />
      <SiteFooter />
    </div>
  );
}
