import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import UploadContent from "./UploadContent";

// Server Component: SiteHeader usa auth()/db (Neon) e não pode ir para o browser.
// A parte interativa (input de arquivo, hash, upload, poll) fica em UploadContent.
export default function UploadPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <UploadContent />
      <SiteFooter />
    </div>
  );
}
