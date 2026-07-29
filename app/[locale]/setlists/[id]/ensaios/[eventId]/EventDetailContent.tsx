"use client";

/**
 * Página do ensaio/show (Fase S1 / ADR-BTS-005).
 *
 * Uma tela, duas visões. O servidor manda a MESMA carga para todo mundo — a
 * grade de prontidão é legível por toda a banda (D12) — e aqui se decide o que
 * cada um pode MEXER:
 *   · líder     → pauta, escalação, ata (D11)
 *   · integrante→ a própria presença (D3) e a própria prontidão (D4)
 *
 * O integrante entra pelo "Meu ensaio": o cartão do que é dele, no topo, com o
 * botão que abre o player no trecho combinado e com o instrumento dele mutado.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { htmlLang, type Locale } from "@/src/i18n/routing";
import { useRouter } from "@/src/i18n/navigation";

// ─── Tipos da resposta da API ────────────────────────────────────────────────
type EventData = {
  id: number;
  setlistId: number;
  bandId: number | null;
  type: string;
  title: string;
  startsAt: string;
  durationMin: number | null;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
};

type RepertoireItem = {
  setlistSongId: number;
  position: number;
  notes: string | null;
  songId: number;
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  duration: number;
  thumbnailUrl: string | null;
};

type PautaItem = { id: number; setlistSongId: number; status: string; note: string | null };

type Assignment = {
  id: number;
  setlistSongId: number;
  userId: number;
  userName: string | null;
  userImage: string | null;
  instrument: string | null;
  focus: string | null;
  loopStartSec: number | null;
  loopEndSec: number | null;
  readiness: string;
  updatedAt: string;
};

type Attendance = { userId: number; status: string; respondedAt: string };
type Member = { userId: number | null; name: string | null; image: string | null; instrument: string | null };

type Payload = {
  role: "leader" | "member";
  viewerId: number;
  viewerInstrument: string | null;
  setlist: { id: number; name: string; bandId: number | null } | null;
  event: EventData;
  repertoire: RepertoireItem[];
  items: PautaItem[];
  assignments: Assignment[];
  attendance: Attendance[];
  members: Member[];
};

// ─── Rótulos ─────────────────────────────────────────────────────────────────
// As CHAVES (rehearsal, drums, ready…) são dado: vão para o banco e para a
// API. Só o rótulo muda de idioma — ver messages/*.json, namespace "rehearsal".
const TYPE_KEY: Record<string, string> = {
  rehearsal: "typeRehearsal",
  show: "typeShow",
  practice: "typePractice",
};

const INSTRUMENT_KEY: Record<string, string> = {
  drums: "instDrums",
  bass: "instBass",
  guitar: "instGuitar",
  harmony: "instHarmony",
  melody: "instMelody",
  vocal: "instVocal",
};

/** Semáforo de prontidão (D4): três níveis, um toque. */
const READINESS: { key: string; icon: string; labelKey: string }[] = [
  { key: "todo", icon: "⚪", labelKey: "readyTodo" },
  { key: "studying", icon: "🟡", labelKey: "readyStudying" },
  { key: "ready", icon: "🟢", labelKey: "readyReady" },
];

const ATTENDANCE: { key: string; icon: string; labelKey: string }[] = [
  { key: "yes", icon: "✅", labelKey: "attYes" },
  { key: "maybe", icon: "🤔", labelKey: "attMaybe" },
  { key: "no", icon: "❌", labelKey: "attNo" },
];

const ITEM_STATUS: Record<string, { icon: string; labelKey: string }> = {
  planned: { icon: "•", labelKey: "statusPlanned" },
  done: { icon: "✔", labelKey: "statusDone" },
  repeat: { icon: "↻", labelKey: "statusRepeat" },
};

// ─── Utilidades de tempo ─────────────────────────────────────────────────────
/** "1:45" ou "105" → 105 segundos. Devolve null se não der para ler. */
function parseTime(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  if (s.includes(":")) {
    const [m, sec] = s.split(":");
    const mm = Number(m);
    const ss = Number(sec);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return mm * 60 + ss;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtTime(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatWhen(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Deep link do "{t("study")}" da escalação — modo OUVIR COMO É: ?solo= isola a
 * trilha do instrumento (as outras entram silenciadas) e ?loop= abre no trecho
 * combinado. Para tocar JUNTO com a banda, o link é ?sl=<setlistSongId>, que
 * aplica a mixagem do setlist e muta a própria trilha.
 */
/** Destino da música com solo/loop já aplicados. Forma tipada: o next-intl
 *  resolve o slug traduzido do idioma corrente (ver src/i18n/routing.ts). */
function songHref(slug: string, instrument: string | null, start: number | null, end: number | null) {
  const query: Record<string, string> = {};
  if (instrument) query.solo = instrument;
  if (start != null && end != null && end > start) query.loop = `${start}-${end}`;
  return { pathname: "/song/[slug]" as const, params: { slug }, query };
}

const input = {
  padding: "8px 11px",
  borderRadius: 8,
  border: "1px solid var(--border2)",
  background: "var(--surface2)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
};

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
};

const sectionTitle = {
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.1em",
  color: "var(--muted)",
  margin: "0 0 14px",
};

// ═════════════════════════════════════════════════════════════════════════════
export default function EventDetailContent({
  setlistId,
  eventId,
}: {
  setlistId: string;
  eventId: string;
}) {
  const t = useTranslations("rehearsal");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? t("errLoad"));
        return;
      }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [setlistId, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>{tc("loading")}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ ...card, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{error ?? t("notFound")}</p>
        </div>
      </div>
    );
  }

  const isLeader = data.role === "leader";
  const isBand = !!data.event.bandId;

  return (
    <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <Link
        href={{ pathname: "/setlists/[id]", params: { id: String(setlistId) } }}
        style={{ color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 16 }}
      >
        ← {data.setlist?.name ?? t("setlistFallback")}
      </Link>

      <EventHeader
        setlistId={setlistId}
        eventId={eventId}
        event={data.event}
        isLeader={isLeader}
        onChanged={load}
        onDeleted={() => router.push({ pathname: "/setlists/[id]", params: { id: String(setlistId) } })}
      />

      {isBand && (
        <AttendanceBlock
          setlistId={setlistId}
          eventId={eventId}
          data={data}
          onChanged={load}
        />
      )}

      {/* Meu ensaio — o cartão do integrante vem ANTES da pauta geral. */}
      <MyAssignments setlistId={setlistId} eventId={eventId} data={data} onChanged={load} />

      <Pauta setlistId={setlistId} eventId={eventId} data={data} isLeader={isLeader} onChanged={load} />

      {isBand && data.assignments.length > 0 && <ReadinessGrid data={data} />}

      <Minutes setlistId={setlistId} eventId={eventId} event={data.event} isLeader={isLeader} onChanged={load} />
    </div>
  );
}

// ─── Cabeçalho do evento ─────────────────────────────────────────────────────
function EventHeader({
  setlistId,
  eventId,
  event,
  isLeader,
  onChanged,
  onDeleted,
}: {
  setlistId: string;
  eventId: string;
  event: EventData;
  isLeader: boolean;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("rehearsal");
  const ts = useTranslations("setlists");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(event.startsAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [location, setLocation] = useState(event.location ?? "");
  const [durationMin, setDurationMin] = useState(event.durationMin?.toString() ?? "");
  const [agenda, setAgenda] = useState(event.agenda ?? "");

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt: new Date(startsAt).toISOString(),
          location: location || null,
          durationMin: durationMin ? Number(durationMin) : null,
          agenda: agenda || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(t("confirmDelete", { title: event.title }))) return;
    const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  if (editing) {
    return (
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...input, gridColumn: "1 / -1" }} />
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={input} />
          <input
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value.replace(/\D/g, ""))}
            placeholder={t("durationPlaceholder")}
            inputMode="numeric"
            style={input}
          />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} style={{ ...input, gridColumn: "1 / -1" }} />
        </div>
        <textarea
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={2}
          placeholder={t("goalPlaceholder")}
          style={{ ...input, width: "100%", resize: "vertical", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: "7px 16px", fontSize: 12 }}>
            {saving ? tc("loading") : tc("save")}
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ padding: "7px 16px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}
          >
            {tc("cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 5,
                background: event.type === "show" ? "rgba(255,154,0,0.14)" : "var(--surface3)",
                color: event.type === "show" ? "var(--accent)" : "var(--muted)",
              }}
            >
              {TYPE_KEY[event.type] ? ts(TYPE_KEY[event.type]) : event.type}
            </span>
            <h1 style={{ fontWeight: 900, fontSize: 22, margin: 0, color: "var(--text)" }}>{event.title}</h1>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            📅 {formatWhen(event.startsAt, htmlLang[locale])}
            {event.durationMin ? ` · ${event.durationMin} min` : ""}
            {event.location ? ` · 📍 ${event.location}` : ""}
          </p>
          {event.agenda && (
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-wrap" }}>
              🎯 {event.agenda}
            </p>
          )}
        </div>
        {isLeader && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setEditing(true)}
              style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}
            >
              {tc("edit")}
            </button>
            <button
              onClick={remove}
              style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}
            >
              {tc("delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Presença (D3) ───────────────────────────────────────────────────────────
function AttendanceBlock({
  setlistId,
  eventId,
  data,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  data: Payload;
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const [saving, setSaving] = useState(false);
  const mine = data.attendance.find((a) => a.userId === data.viewerId)?.status ?? null;
  const byUser = new Map(data.attendance.map((a) => [a.userId, a.status]));

  async function answer(status: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <p style={sectionTitle}>{t("attendanceTitle")}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {ATTENDANCE.map((a) => (
          <button
            key={a.key}
            onClick={() => answer(a.key)}
            disabled={saving}
            style={{
              padding: "7px 14px",
              fontSize: 13,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              border: mine === a.key ? "1px solid var(--accent)" : "1px solid var(--border2)",
              background: mine === a.key ? "rgba(255,154,0,0.12)" : "transparent",
              color: mine === a.key ? "var(--accent)" : "var(--text)",
            }}
          >
            {a.icon} {t(a.labelKey)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {data.members.map((m, i) => {
          const st = m.userId != null ? byUser.get(m.userId) : undefined;
          const icon = ATTENDANCE.find((a) => a.key === st)?.icon ?? "·";
          return (
            <span key={m.userId ?? `m-${i}`} style={{ fontSize: 12, color: "var(--muted)" }}>
              {icon} {m.name ?? t("memberFallback")}
              {m.instrument ? ` (${INSTRUMENT_KEY[m.instrument] ? t(INSTRUMENT_KEY[m.instrument]) : m.instrument})` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Meu ensaio: o cartão do integrante ──────────────────────────────────────
function MyAssignments({
  setlistId,
  eventId,
  data,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  data: Payload;
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const mine = data.assignments.filter((a) => a.userId === data.viewerId);
  const songById = useMemo(
    () => new Map(data.repertoire.map((r) => [r.setlistSongId, r])),
    [data.repertoire],
  );

  if (mine.length === 0) return null;

  return (
    <div style={{ ...card, borderColor: "rgba(255,154,0,0.35)", background: "linear-gradient(135deg, var(--surface) 0%, rgba(255,154,0,0.05) 100%)" }}>
      <p style={{ ...sectionTitle, color: "var(--accent)" }}>{t("myRehearsal")}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mine.map((a) => {
          const song = songById.get(a.setlistSongId);
          return (
            <div key={a.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 15, color: "var(--text)" }}>{song?.title ?? t("song")}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    {song ? t("songMeta", { artist: song.artist, key: song.key, bpm: song.bpm }) : ""}
                  </span>
                  {a.instrument && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--surface3)", padding: "2px 8px", borderRadius: 5 }}>
                      {INSTRUMENT_KEY[a.instrument] ? t(INSTRUMENT_KEY[a.instrument]) : a.instrument}
                    </span>
                  )}
                </div>
                {song && (
                  <Link
                    href={songHref(song.slug, a.instrument, a.loopStartSec, a.loopEndSec)}
                    className="btn-primary"
                    style={{ padding: "7px 16px", fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    {t("study")}
                  </Link>
                )}
              </div>

              {a.focus && (
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0", lineHeight: 1.5 }}>
                  🎯 {a.focus}
                  {a.loopStartSec != null && a.loopEndSec != null && (
                    <span style={{ color: "var(--muted2)" }}>
                      {" "}· trecho {fmtTime(a.loopStartSec)}–{fmtTime(a.loopEndSec)}
                    </span>
                  )}
                </p>
              )}

              <ReadinessButtons
                setlistId={setlistId}
                eventId={eventId}
                assignmentId={a.id}
                current={a.readiness}
                onChanged={onChanged}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Semáforo editável — só aparece para o dono da atribuição (D4). */
function ReadinessButtons({
  setlistId,
  eventId,
  assignmentId,
  current,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  assignmentId: number;
  current: string;
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const [saving, setSaving] = useState(false);

  async function set(readiness: string) {
    if (saving || readiness === current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, readiness }),
      });
      if (res.ok) onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
      {READINESS.map((r) => (
        <button
          key={r.key}
          onClick={() => set(r.key)}
          disabled={saving}
          style={{
            padding: "5px 12px",
            fontSize: 12,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 600,
            border: current === r.key ? "1px solid var(--accent)" : "1px solid var(--border2)",
            background: current === r.key ? "rgba(255,154,0,0.12)" : "transparent",
            color: current === r.key ? "var(--accent)" : "var(--muted)",
          }}
        >
          {r.icon} {t(r.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ─── Pauta + escalação ───────────────────────────────────────────────────────
function Pauta({
  setlistId,
  eventId,
  data,
  isLeader,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  data: Payload;
  isLeader: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const tc = useTranslations("common");
  const [adding, setAdding] = useState("");
  const songById = useMemo(
    () => new Map(data.repertoire.map((r) => [r.setlistSongId, r])),
    [data.repertoire],
  );
  const inPauta = new Set(data.items.map((i) => i.setlistSongId));
  const available = data.repertoire.filter((r) => !inPauta.has(r.setlistSongId));

  async function addItem(setlistSongId: number) {
    const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setlistSongId }),
    });
    if (res.ok) {
      setAdding("");
      onChanged();
    }
  }

  async function setStatus(itemId: number, status: string) {
    const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, status }),
    });
    if (res.ok) onChanged();
  }

  async function removeItem(itemId: number) {
    const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/items?itemId=${itemId}`, {
      method: "DELETE",
    });
    if (res.ok) onChanged();
  }

  return (
    <div style={card}>
      <p style={sectionTitle}>{t("agendaTitle")}</p>

      {isLeader && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <select
            value={adding}
            onChange={(e) => {
              setAdding(e.target.value);
              if (e.target.value) addItem(Number(e.target.value));
            }}
            style={{ ...input, flex: 1 }}
            disabled={available.length === 0}
          >
            <option value="">
              {available.length === 0 ? t("allInAgenda") : t("addFromRepertoire")}
            </option>
            {available.map((r) => (
              <option key={r.setlistSongId} value={r.setlistSongId}>
                {r.title} — {r.artist}
              </option>
            ))}
          </select>
        </div>
      )}

      {data.items.length === 0 ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic", margin: 0 }}>
          {isLeader
            ? t("emptyAgendaLeader")
            : t("emptyAgendaMember")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.items.map((item) => {
            const song = songById.get(item.setlistSongId);
            const st = ITEM_STATUS[item.status] ?? ITEM_STATUS.planned;
            const rows = data.assignments.filter((a) => a.setlistSongId === item.setlistSongId);

            return (
              <div key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 15, color: "var(--text)" }}>
                      {st.icon} {song?.title ?? t("song")}
                    </strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {song ? t("songMeta", { artist: song.artist, key: song.key, bpm: song.bpm }) : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {song && (
                      /* Tocar junto: aplica a mixagem do setlist e muta a
                         própria trilha. Difere do {t("study")} do cartão, que
                         isola a trilha para aprender a parte de ouvido. */
                      <Link
                        href={{ pathname: "/song/[slug]", params: { slug: song.slug }, query: { sl: String(item.setlistSongId) } }}
                        style={{ padding: "5px 12px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", color: "var(--text)", fontWeight: 600 }}
                      >
                        {t("playAlong")}
                      </Link>
                    )}
                    {isLeader && (
                      <>
                        <button
                          onClick={() => setStatus(item.id, item.status === "done" ? "planned" : "done")}
                          style={{ padding: "5px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontWeight: 600, border: "1px solid var(--border2)", background: item.status === "done" ? "rgba(34,197,94,0.12)" : "transparent", color: "var(--text)" }}
                        >
                          ✔ Ensaiada
                        </button>
                        <button
                          onClick={() => setStatus(item.id, item.status === "repeat" ? "planned" : "repeat")}
                          style={{ padding: "5px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontWeight: 600, border: "1px solid var(--border2)", background: item.status === "repeat" ? "rgba(255,154,0,0.14)" : "transparent", color: "var(--text)" }}
                        >
                          ↻ Repetir
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{ padding: "5px 10px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "var(--danger)", fontWeight: 600 }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Escalados nesta música */}
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((a) => {
                    const r = READINESS.find((x) => x.key === a.readiness) ?? READINESS[0];
                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
                        <span title={t(r.labelKey)}>{r.icon}</span>
                        <strong style={{ color: "var(--text)" }}>{a.userName ?? t("memberFallback")}</strong>
                        {a.instrument && (
                          <span style={{ color: "var(--muted2)", fontSize: 12 }}>
                            ({INSTRUMENT_KEY[a.instrument] ? t(INSTRUMENT_KEY[a.instrument]) : a.instrument})
                          </span>
                        )}
                        {a.focus && <span style={{ color: "var(--muted)" }}>— {a.focus}</span>}
                        {a.loopStartSec != null && a.loopEndSec != null && (
                          <span style={{ color: "var(--muted2)", fontSize: 12 }}>
                            [{fmtTime(a.loopStartSec)}–{fmtTime(a.loopEndSec)}]
                          </span>
                        )}
                        {isLeader && (
                          <button
                            onClick={async () => {
                              const res = await fetch(
                                `/api/setlists/${setlistId}/events/${eventId}/assignments?assignmentId=${a.id}`,
                                { method: "DELETE" },
                              );
                              if (res.ok) onChanged();
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 12, fontWeight: 600 }}
                          >
                            {tc("remove")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isLeader && data.members.length > 0 && (
                  <AssignForm
                    setlistId={setlistId}
                    eventId={eventId}
                    setlistSongId={item.setlistSongId}
                    members={data.members.filter((m) => !rows.some((a) => a.userId === m.userId))}
                    onChanged={onChanged}
                  />
                )}

                {item.note && (
                  <p style={{ color: "var(--muted)", fontSize: 12, margin: "8px 0 0", fontStyle: "italic" }}>📝 {item.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Formulário de escalação — instrumento vem do cadastro do membro. */
function AssignForm({
  setlistId,
  eventId,
  setlistSongId,
  members,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  setlistSongId: number;
  members: Member[];
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [focus, setFocus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (members.length === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: "8px 0 0" }}
      >
        {t("assignMember")}
      </button>
    );
  }

  async function submit() {
    if (!userId || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setlistSongId,
          userId: Number(userId),
          focus: focus.trim() || null,
          loopStartSec: parseTime(from),
          loopEndSec: parseTime(to),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? t("errAssign"));
        return;
      }
      setOpen(false);
      setUserId("");
      setFocus("");
      setFrom("");
      setTo("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "var(--surface2)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ ...input, flex: "1 1 160px" }}>
          <option value="">{t("whoStudies")}</option>
          {members.map((m) => (
            <option key={m.userId ?? 0} value={m.userId ?? ""}>
              {m.name ?? t("memberFallback")}
              {m.instrument ? ` — ${INSTRUMENT_KEY[m.instrument] ? t(INSTRUMENT_KEY[m.instrument]) : m.instrument}` : ""}
            </option>
          ))}
        </select>
        <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t("fromPlaceholder")} style={{ ...input, width: 90 }} />
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={t("toPlaceholder")} style={{ ...input, width: 90 }} />
      </div>
      <input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="O que treinar (ex: o solo, a virada da ponte)"
        style={{ ...input, width: "100%", marginBottom: 8 }}
      />
      {err && <p style={{ color: "var(--danger)", fontSize: 12, margin: "0 0 8px" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={!userId || saving} className="btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>
          {saving ? "..." : t("assign")}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}
        >
          {tc("cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Grade de prontidão (D12: toda a banda vê) ───────────────────────────────
function ReadinessGrid({ data }: { data: Payload }) {
  const t = useTranslations("rehearsal");
  const songById = useMemo(
    () => new Map(data.repertoire.map((r) => [r.setlistSongId, r])),
    [data.repertoire],
  );

  // Só entram na grade os integrantes que foram escalados em alguma música.
  const people = useMemo(() => {
    const seen = new Map<number, string>();
    for (const a of data.assignments) seen.set(a.userId, a.userName ?? t("memberFallback"));
    return [...seen.entries()].map(([userId, name]) => ({ userId, name }));
  }, [data.assignments]);

  const songIds = useMemo(
    () => [...new Set(data.assignments.map((a) => a.setlistSongId))],
    [data.assignments],
  );

  const cell = (songId: number, userId: number) =>
    data.assignments.find((a) => a.setlistSongId === songId && a.userId === userId);

  return (
    <div style={card}>
      <p style={sectionTitle}>{t("whoStudiedTitle")}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>{t("song")}</th>
              {people.map((p) => (
                <th key={p.userId} style={{ padding: "6px 10px", color: "var(--muted)", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                  {p.name.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {songIds.map((sid) => (
              <tr key={sid} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                  {songById.get(sid)?.title ?? t("song")}
                </td>
                {people.map((p) => {
                  const a = cell(sid, p.userId);
                  const r = a ? READINESS.find((x) => x.key === a.readiness) : null;
                  return (
                    <td key={p.userId} style={{ padding: "8px 10px", textAlign: "center" }} title={r ? t(r.labelKey) : t("notAssigned")}>
                      {r ? r.icon : <span style={{ color: "var(--muted2)" }}>–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--muted2)", fontSize: 11, margin: "12px 0 0" }}>
        {t("readinessFooter")}
      </p>
    </div>
  );
}

// ─── Ata ─────────────────────────────────────────────────────────────────────
function Minutes({
  setlistId,
  eventId,
  event,
  isLeader,
  onChanged,
}: {
  setlistId: string;
  eventId: string;
  event: EventData;
  isLeader: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("rehearsal");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(event.minutes ?? "");
  const [saving, setSaving] = useState(false);

  if (!isLeader && !event.minutes) return null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: draft.trim() || null }),
      });
      if (res.ok) {
        setEditing(false);
        onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <p style={sectionTitle}>{t("afterTitle")}</p>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder={t("minutesPlaceholder")}
            style={{ ...input, width: "100%", resize: "vertical", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: "7px 16px", fontSize: 12 }}>
              {saving ? tc("loading") : tc("save")}
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(event.minutes ?? ""); }}
              style={{ padding: "7px 16px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}
            >
              {tc("cancel")}
            </button>
          </div>
        </>
      ) : (
        <>
          {event.minutes ? (
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{event.minutes}</p>
          ) : (
            <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic", margin: 0 }}>
              {t("noMinutes")}
            </p>
          )}
          {isLeader && (
            <button
              onClick={() => setEditing(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: "10px 0 0" }}
            >
              {event.minutes ? t("editMinutes") : t("addMinutes")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
