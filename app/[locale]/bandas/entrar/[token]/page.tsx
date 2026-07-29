import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import JoinContent from "./JoinContent";

export default async function JoinBandPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <JoinContent token={token} />
      <SiteFooter />
    </div>
  );
}
