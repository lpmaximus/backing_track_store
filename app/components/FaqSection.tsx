export type FaqItem = { q: string; a: string };

/** Bloco de FAQ reutilizável (home e /planos). Componente puramente
 *  apresentacional — sem "use client" e sem acesso a banco, então pode ser
 *  importado tanto de Server Components quanto de Client Components.
 *
 *  Emite também JSON-LD schema.org/FAQPage: é o único dado estruturado do
 *  site hoje e é o que o Google usa para o rich result de perguntas. */
export default function FaqSection({
  items,
  kicker,
  title,
  id,
}: {
  items: FaqItem[];
  kicker?: string;
  title?: string;
  id?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify de conteúdo estático nosso — sem input de usuário.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {kicker && <div className="kicker">{kicker}</div>}
      {title && (
        <h2 style={{
          fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px",
          margin: "14px 0 0", lineHeight: 1.08, color: "var(--text)",
        }}>
          {title}
        </h2>
      )}

      <div
        id={id}
        className="planos-faq-grid"
        style={{
          marginTop: title || kicker ? 40 : 0,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        {items.map(({ q, a }) => (
          <div key={q} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "18px 22px",
          }}>
            <p style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, margin: "0 0 8px" }}>{q}</p>
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0, lineHeight: 1.65 }}>{a}</p>
          </div>
        ))}
      </div>
    </>
  );
}
