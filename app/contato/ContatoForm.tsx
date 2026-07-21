"use client";

import { useState } from "react";

const CONTACT_EMAIL = "contato@l2techs.com";

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 8,
  border: "1px solid var(--border2)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

export default function ContatoForm() {
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const body = `${message}\n\n—\nNome: ${name}\nE-mail: ${email}`;
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject || "Contato pelo site"
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setSent(true);
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      borderRadius: 16, padding: "32px 28px", maxWidth: 560,
    }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>NOME</span>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)}
            placeholder="Seu nome" style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>E-MAIL</span>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>ASSUNTO</span>
          <input
            type="text" required value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Sobre o que você quer falar?" style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>MENSAGEM</span>
          <textarea
            required value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Escreva sua mensagem" rows={6}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <button type="submit" className="btn-primary" style={{ justifyContent: "center", marginTop: 4 }}>
          Enviar mensagem
        </button>

        {sent && (
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, textAlign: "center" }}>
            Abrimos seu aplicativo de e-mail com a mensagem pronta para envio. Se nada abrir, escreva
            diretamente para{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ textDecoration: "underline", color: "var(--accent)", fontWeight: 600 }}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        )}
      </form>
    </div>
  );
}
