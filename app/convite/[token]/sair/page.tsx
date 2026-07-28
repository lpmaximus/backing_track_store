/**
 * /convite/<token>/sair — descadastro em um clique.
 *
 * Existe por dois motivos: (1) é o destino do header List-Unsubscribe, que é um
 * dos sinais antispam mais fortes que um remetente pequeno pode dar; (2) dar
 * uma saída óbvia e sem login é exatamente o que um phishing não faz.
 */
import Link from "next/link";
import { unsubscribe } from "@/src/lib/invites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SairPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await unsubscribe(token);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16, padding: "36px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", marginBottom: 16 }}>
          Backing<span style={{ color: "var(--accent)" }}>Track</span>.store
        </div>
        <h1 style={{ color: "var(--text)", fontSize: 19, fontWeight: 800, margin: "0 0 10px" }}>Pronto, descadastrado</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Você não vai receber mais convites nossos. Se isso foi engano ou se mudar de ideia, é só
          escrever para <a href="mailto:contato@l2techs.com" style={{ color: "var(--accent)" }}>contato@l2techs.com</a>.
        </p>
        <Link href="/" style={{ color: "var(--muted2)", fontSize: 13, textDecoration: "underline", display: "inline-block", marginTop: 20 }}>
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
