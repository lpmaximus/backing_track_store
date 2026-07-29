"use client";

/**
 * Aba Ensaios do setlist (Fase S1 / ADR-BTS-005).
 *
 * Lista os ensaios e shows e deixa o líder criar. Para o integrante, esta é a
 * porta de entrada: o cartão mostra se ele já respondeu presença e quantas
 * músicas foram atribuídas a ele — o "aviso in-app" que substitui o e-mail
 * enquanto a D9 não tem provider.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { htmlLang, type Locale } from "@/src/i18n/routing";

export type EventRow = {
  id: number;
  type: string;
  title: string;
  startsAt: string;
  durationMin: number | null;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  assignedCount: number;
  readyCount: number;
  myAssignments: number;
  myAttendance: string | null;
};

/** D15: "Evento" existe só no banco; o músico vê Ensaio, Show ou Sessão.
 *  O valor (rehearsal/show/practice) é dado; só a chave de tradução muda. */
export const TYPE_KEY: Record<string, string> = {
  rehearsal: "typeRehearsal",
  show: "typeShow",
  practice: "typePractice",
};

export function formatWhen(iso: string, locale: string) {
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor para <input type="datetime-local"> no fuso local, sem virar UTC. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SetlistEvents({
  setlistId,
  isBand,
  canManage,
}: {
  setlistId: string;
  isBand: boolean;
  canManage: boolean;
}) {
  const t = useTranslations("setlists");
  const tc = useTranslations("common");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Padrão: ensaio para banda, sessão de estudo para setlist pessoal (D6).
  const [type, setType] = useState(isBand ? "rehearsal" : "practice");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlistId]);

  function openForm() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
    setStartsAt(toLocalInput(d));
    setTitle(isBand ? t("defaultTitleBand") : t("defaultTitleSolo"));
    setShowForm(true);
    setError(null);
  }

  async function create() {
    if (!title.trim() || !startsAt || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          startsAt: new Date(startsAt).toISOString(),
          durationMin: durationMin ? Number(durationMin) : null,
          location: location.trim() || null,
          agenda: agenda.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errCreateEvent"));
        return;
      }
      setShowForm(false);
      setTitle("");
      setLocation("");
      setAgenda("");
      setDurationMin("");
      load();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--border2)",
    background: "var(--surface2)",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.startsAt).getTime() >= now - 6 * 3600_000);
  const past = events.filter((e) => new Date(e.startsAt).getTime() < now - 6 * 3600_000).reverse();

  return (
    <div style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
        <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: 0 }}>
          {isBand ? t("eventsBand") : t("eventsSolo")}
        </p>
        {canManage && !showForm && (
          <button onClick={openForm} className="btn-primary" style={{ padding: "7px 16px", fontSize: 12 }}>
            + {isBand ? t("newEventBand") : t("newEventSolo")}
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: 14, marginBottom: 16, background: "var(--surface2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {isBand && (
              <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                <option value="rehearsal">{t("typeRehearsal")}</option>
                <option value="show">{t("typeShow")}</option>
              </select>
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("eventTitlePlaceholder")}
              maxLength={200}
              style={inputStyle}
            />
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle} />
            <input
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ""))}
              placeholder={t("eventDurationPlaceholder")}
              inputMode="numeric"
              style={inputStyle}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("eventLocationPlaceholder")}
              maxLength={200}
              style={{ ...inputStyle, gridColumn: "1 / -1" }}
            />
          </div>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={2}
            placeholder={t("eventGoalPlaceholder")}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={!title.trim() || !startsAt || saving} className="btn-primary" style={{ padding: "7px 16px", fontSize: 12 }}>
              {saving ? t("creatingEvent") : t("createEvent")}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{ padding: "7px 16px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: 0 }}>{tc("loading")}</p>
      ) : events.length === 0 ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic", margin: 0 }}>
          {canManage
            ? t("emptyEventsLeader")
            : t("emptyEventsMember")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {upcoming.map((e) => (
            <EventCard key={e.id} setlistId={setlistId} ev={e} isBand={isBand} />
          ))}
          {past.length > 0 && (
            <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted2)", margin: "10px 0 0" }}>
              {t("pastEvents")}
            </p>
          )}
          {past.map((e) => (
            <EventCard key={e.id} setlistId={setlistId} ev={e} isBand={isBand} dimmed />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  setlistId,
  ev,
  isBand,
  dimmed,
}: {
  setlistId: string;
  ev: EventRow;
  isBand: boolean;
  dimmed?: boolean;
}) {
  const t = useTranslations("setlists");
  const locale = useLocale() as Locale;
  const pending = ev.myAssignments > 0 && ev.myAttendance == null;

  return (
    <Link
      href={{ pathname: "/setlists/[id]/ensaios/[eventId]", params: { id: String(setlistId), eventId: String(ev.id) } }}
      style={{
        display: "block",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        color: "inherit",
        opacity: dimmed ? 0.65 : 1,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 5,
            background: ev.type === "show" ? "rgba(255,154,0,0.14)" : "var(--surface3)",
            color: ev.type === "show" ? "var(--accent)" : "var(--muted)",
          }}
        >
          {TYPE_KEY[ev.type] ? t(TYPE_KEY[ev.type]) : ev.type}
        </span>
        <strong style={{ fontSize: 14, color: "var(--text)" }}>{ev.title}</strong>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{formatWhen(ev.startsAt, htmlLang[locale])}</span>
        {ev.location && <span style={{ color: "var(--muted2)", fontSize: 12 }}>· {ev.location}</span>}
      </div>

      {isBand && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
          {ev.assignedCount > 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {t("readyCount", { ready: ev.readyCount, total: ev.assignedCount })}
            </span>
          )}
          {ev.myAssignments > 0 && (
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>
              {t("mySongsCount", { count: ev.myAssignments })}
            </span>
          )}
          {pending && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>{t("confirmAttendance")}</span>
          )}
        </div>
      )}
    </Link>
  );
}
