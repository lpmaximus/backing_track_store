import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  varchar,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";

// ─── Songs ────────────────────────────────────────────────────────────────────
export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  artist: varchar("artist", { length: 255 }).notNull(),
  genre: varchar("genre", { length: 100 }).notNull(),
  key: varchar("key", { length: 10 }).notNull(),
  bpm: integer("bpm").notNull(),
  duration: integer("duration").notNull().default(0), // seconds
  // Audio: mix completo (free). URL pública no R2.
  audioUrl: text("audio_url"),
  // Cifra: texto com seções e timecodes em JSON
  // [{ section: "Verso", timecode: 12, chords: "Am G F E" }]
  chords: jsonb("chords").$type<ChordSection[]>(),
  // Cifra texto puro (legado / fallback)
  cifraText: text("cifra_text"),
  // ─── Letra sincronizada (caminho 3: Whisper no vocal + correção comunidade) ─
  // [{ time: 12.4, text: "linha da letra" }] — sincronizada por timecode.
  lyrics: jsonb("lyrics").$type<LyricsLine[]>(),
  lyricsSource: varchar("lyrics_source", { length: 20 }), // auto | community
  lyricsStatus: varchar("lyrics_status", { length: 20 }), // draft | validated
  // Thumbnail opcional
  thumbnailUrl: text("thumbnail_url"),
  // Visível no catálogo?
  published: boolean("published").notNull().default(false),
  // Compartilhar upload do usuário no catálogo entre Pros? (privado por padrão)
  shared: boolean("shared").notNull().default(false),
  // ─── Fase 1.5 (pivô: upload do usuário) ──────────────────────────────────
  // Origem do registro: curadoria admin ou upload de usuário final
  sourceType: varchar("source_type", { length: 20 }).notNull().default("admin"), // admin | user_upload
  // Quem enviou (só para user_upload)
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  // SHA-256 do arquivo original — dedupe de catálogo (cache por hash)
  sourceHash: varchar("source_hash", { length: 64 }).unique(),
  // Estado do pipeline de processamento
  processingStatus: varchar("processing_status", { length: 20 }).notNull().default("ready"), // ready | queued | separating | transcribing | failed
  // Origem da cifra
  chordsSource: varchar("chords_source", { length: 20 }).notNull().default("admin"), // admin | auto | community
  // Estado de validação da cifra (admin sempre validated)
  chordsStatus: varchar("chords_status", { length: 20 }).notNull().default("validated"), // draft | validated
  // Batidas detectadas (tempos em s) — p/ o metrônomo sincronizado. bpm/key acima.
  beats: jsonb("beats").$type<number[]>(),
  // Moderação do catálogo (R3 / ADR-BTS-003): approved (visível), pending
  // (aguardando revisão), blocked (oculto por denúncia/disputa, sem apagar).
  moderationStatus: varchar("moderation_status", { length: 20 }).notNull().default("approved"), // approved | pending | blocked
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Stems ────────────────────────────────────────────────────────────────────
// Cada linha = um stem de uma música (drums, bass, guitar, harmony…)
export const stems = pgTable("stems", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  instrument: varchar("instrument", { length: 50 }).notNull(), // drums | bass | guitar | harmony | melody
  label: varchar("label", { length: 100 }), // ex: "Bateria", "Baixo"
  audioUrl: text("audio_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  image: text("image"),
  // NextAuth provider (google | credentials)
  provider: varchar("provider", { length: 50 }).notNull().default("credentials"),
  providerId: text("provider_id"),
  passwordHash: text("password_hash"), // null para OAuth
  asaasCustomerId: text("asaas_customer_id"),
  role: varchar("role", { length: 20 }).notNull().default("free"), // free | pro | proband | admin
  // ─── Admin MVP (R3 / ADR-BTS-003) ───────────────────────────────────────
  // Estado da conta para moderação: active (normal), blocked (suspenso,
  // reversível), banned (permanente). Bloqueio nega login (ver auth.ts).
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | blocked | banned
  blockReason: text("block_reason"),
  // Hard delete LGPD com retenção: marcado aqui; purga definitiva após 30 dias
  // (rota /api/admin/users/purge, disparada por cron/manual).
  deletionScheduledAt: timestamp("deletion_scheduled_at"),
  // ─── Trial por convite (aba /admin/convites) ────────────────────────────
  // O trial NÃO cria um role novo: `role` é promovido para pro|proband e estes
  // campos guardam a validade + o role de origem para o rebaixamento. Assim
  // todo o código de permissão existente (permissions.ts, access.ts, quota.ts)
  // continua valendo sem nenhuma alteração. Expiração: src/lib/trials.ts.
  trialPlan: varchar("trial_plan", { length: 20 }),          // pro | proband (null = sem trial)
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialPreviousRole: varchar("trial_previous_role", { length: 20 }), // role para voltar no fim
  trialSource: varchar("trial_source", { length: 30 }),      // invite | manual
  // Cota de separações do trial: TOTAL do período, não por mês. null = usa o
  // limite normal do plano (quota.ts). A contagem corre desde trialStartedAt e
  // não reseta enquanto o trial durar — é um "pacote" fechado de créditos.
  trialSeparations: integer("trial_separations"),
  // ─── Analytics de produto ───────────────────────────────────────────────
  // Última vez que o usuário deu qualquer sinal de vida (qualquer evento em
  // user_activity atualiza aqui). Serve para separar ativo × dormente sem
  // precisar varrer a tabela de eventos.
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Atividade do usuário logado (analytics de produto) ───────────────────────
// O Google Analytics enxerga visitante anônimo; esta tabela enxerga QUEM fez o
// quê. Só grava usuário autenticado e só eventos da whitelist em
// src/lib/activity.ts — nunca dado livre vindo do client.
export const userActivity = pgTable(
  "user_activity",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // play | mixer | cifra | letra | setlist_open | setlist_create | stage_mode
    // | upload | export | login
    event: varchar("event", { length: 30 }).notNull(),
    songId: integer("song_id").references(() => songs.id, { onDelete: "set null" }),
    // Contexto extra do evento (ex.: { stem: "drums", muted: true }). Opcional.
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    byUserDate: index("user_activity_user_created_idx").on(t.userId, t.createdAt),
    byDate: index("user_activity_created_idx").on(t.createdAt),
    byEvent: index("user_activity_event_idx").on(t.event),
  }),
);

// ─── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  asaasCustomerId: text("asaas_customer_id"),
  asaasSubscriptionId: text("asaas_subscription_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  status: varchar("status", { length: 50 }).notNull().default("trialing"),
  // trialing | active | past_due | canceled | unpaid
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Comments ─────────────────────────────────────────────────────────────────
// Free pode ler; apenas Pro/admin podem escrever (checagem feita na API).
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Setlists (Pro) ───────────────────────────────────────────────────────────
export const setlists = pgTable("setlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Fase 1.5: setlist de banda (null = setlist pessoal, comportamento atual)
  bandId: integer("band_id").references(() => bands.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  notes: text("notes"), // anotações gerais do show (data, local, observações)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Músicas dentro de uma setlist, com ordem e anotação por música
export const setlistSongs = pgTable("setlist_songs", {
  id: serial("id").primaryKey(),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  notes: text("notes"), // anotação por música (ex: "tocar 1 tom abaixo")
  // ─── Preparo do repertório (Fase S2 / ADR-BTS-005) ───────────────────────
  // Tom e velocidade saem do campo de notas e viram dados: o player já suporta
  // os dois, e "tocar 1 tom abaixo" escrito à mão não afeta o áudio.
  transposeSemitones: integer("transpose_semitones").notNull().default(0),
  // numeric no banco → o driver devolve string; converter na borda.
  speed: numeric("speed", { precision: 3, scale: 2 }).notNull().default("1.00"),
  // Respiro antes da próxima música no modo palco. 0 = emenda.
  gapSeconds: integer("gap_seconds").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Mixagem do setlist (Fase S2 / ADR-BTS-005, D5) ───────────────────────────
// Camada 1 das três: o padrão que o líder define na aba Mixagem. Uma linha por
// stem por música — cinco por música no pipeline atual.
export const setlistSongMix = pgTable("setlist_song_mix", {
  id: serial("id").primaryKey(),
  setlistSongId: integer("setlist_song_id")
    .notNull()
    .references(() => setlistSongs.id, { onDelete: "cascade" }),
  stemKey: varchar("stem_key", { length: 50 }).notNull(), // vocal | drums | bass | guitar | harmony
  state: varchar("state", { length: 10 }).notNull().default("on"), // on | mute | solo
  volume: integer("volume").notNull().default(100), // 0–100
});

// Camada 3: o ajuste pessoal, que só o dono vê. Camada 2 (auto-mute do
// instrumento do integrante) é derivada de band_members.instrument e não tem
// tabela — ver src/lib/mix.ts.
export const setlistSongMixUser = pgTable("setlist_song_mix_user", {
  id: serial("id").primaryKey(),
  setlistSongId: integer("setlist_song_id")
    .notNull()
    .references(() => setlistSongs.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stemKey: varchar("stem_key", { length: 50 }).notNull(),
  state: varchar("state", { length: 10 }).notNull().default("on"),
  volume: integer("volume").notNull().default(100),
});

// Comentários no repertório da banda (R2 / ADR-BTS-002).
// Todo membro ativo da banda dona da setlist escreve (inclui FreeBand). Difere
// de `comments` (comunidade na página da música, só Pro/ProBand).
export const setlistComments = pgTable("setlist_comments", {
  id: serial("id").primaryKey(),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Bands (Fase 1.5) ─────────────────────────────────────────────────────────
// Uma banda tem repertório recorrente (várias setlists, mesmos membros).
export const bands = pgTable("bands", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  leaderUserId: integer("leader_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Assinatura Banda (o líder paga; membros ativos herdam acesso Pro)
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bandMembers = pgTable("band_members", {
  id: serial("id").primaryKey(),
  bandId: integer("band_id")
    .notNull()
    .references(() => bands.id, { onDelete: "cascade" }),
  // null enquanto o convite não foi aceito
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email"),
  // Token de convite (compartilhado por link no MVP)
  inviteToken: varchar("invite_token", { length: 64 }).unique(),
  instrument: varchar("instrument", { length: 50 }), // drums | bass | guitar | harmony | melody | vocal
  status: varchar("status", { length: 20 }).notNull().default("invited"), // invited | active
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Ensaios e shows (Fase S1 / ADR-BTS-005) ──────────────────────────────────
// O Setlist é o REPERTÓRIO; o Evento é a OCORRÊNCIA datada que aponta para ele
// (D1). Um setlist tem N ensaios e N shows. "Modo Estudo" e "Modo Show" são abas
// da interface, não entidades separadas (D2).
export const setlistEvents = pgTable("setlist_events", {
  id: serial("id").primaryKey(),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  // null = sessão de estudo pessoal do Pro (evento sem participantes, D6)
  bandId: integer("band_id").references(() => bands.id, { onDelete: "cascade" }),
  // rehearsal (Ensaio) | show (Show) | practice (Sessão de estudo do Pro solo) — D15
  type: varchar("type", { length: 20 }).notNull().default("rehearsal"),
  title: varchar("title", { length: 200 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  durationMin: integer("duration_min"),
  location: varchar("location", { length: 200 }),
  agenda: text("agenda"), // objetivo do ensaio, escrito ANTES
  minutes: text("minutes"), // ata, escrita DEPOIS
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Confirmação de presença (D3). O convite é para a BANDA, não para o ensaio —
// aqui só se responde "vou / não vou / talvez".
export const setlistEventAttendance = pgTable("setlist_event_attendance", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => setlistEvents.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 10 }).notNull(), // yes | no | maybe
  respondedAt: timestamp("responded_at").notNull().defaultNow(),
});

// Pauta (antes) e ata (depois) do mesmo ensaio. O que fica como `repeat` entra
// pré-selecionado no ensaio seguinte.
export const setlistEventItems = pgTable("setlist_event_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => setlistEvents.id, { onDelete: "cascade" }),
  setlistSongId: integer("setlist_song_id")
    .notNull()
    .references(() => setlistSongs.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 10 }).notNull().default("planned"), // planned | done | repeat
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Escalação + status de prontidão (D4). `readiness` é a ÚNICA informação que
// sobe do integrante para o líder — só o próprio escalado pode alterá-la.
export const setlistAssignments = pgTable("setlist_assignments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => setlistEvents.id, { onDelete: "cascade" }),
  setlistSongId: integer("setlist_song_id")
    .notNull()
    .references(() => setlistSongs.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  instrument: varchar("instrument", { length: 50 }), // vem do cadastro do membro
  focus: text("focus"), // "solo a partir de 1:45"
  loopStartSec: integer("loop_start_sec"),
  loopEndSec: integer("loop_end_sec"),
  readiness: varchar("readiness", { length: 10 }).notNull().default("todo"), // todo | studying | ready
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Processing jobs (Fase 1.5) ───────────────────────────────────────────────
// Pipeline assíncrono de separação/transcrição via provider externo.
export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull(), // replicate_demucs | musicai
  providerJobId: text("provider_job_id"), // id da prediction no provider (idempotência do webhook)
  stage: varchar("stage", { length: 30 }).notNull(), // separation | chord_detection
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | done | failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── Notificações (Área do Usuário) ───────────────────────────────────────────
// Caixa de mensagens do usuário: avisos gerados automaticamente pelo sistema
// (música pronta, pagamento, integrante de banda) e, no futuro, promoções.
// Sempre por usuário (userId) — sem broadcast/tabela de destinatários por ora;
// um aviso "pra todo mundo" seria inserido em lote (1 linha por usuário).
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull().default("system"), // system | promo | band
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  link: text("link"), // rota interna opcional (ex: /song/slug, /bandas/1)
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Cifra colaborativa (Fase 1.5) ────────────────────────────────────────────
export const cifraEditHistory = pgTable("cifra_edit_history", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  previousChords: jsonb("previous_chords").$type<ChordSection[]>(),
  newChords: jsonb("new_chords").$type<ChordSection[]>(),
  previousCifraText: text("previous_cifra_text"),
  newCifraText: text("new_cifra_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cifraReports = pgTable("cifra_reports", {
  id: serial("id").primaryKey(),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  reportedByUserId: integer("reported_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open | resolved | dismissed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Waitlist ────────────────────────────────────────────────────────────────
/**
 * Cadastros da página "Em breve". A tabela é criada em runtime por
 * /api/waitlist (CREATE TABLE IF NOT EXISTS) desde antes do drizzle cobrir tudo.
 * Está declarada aqui SÓ para o `drizzle-kit push` reconhecê-la como parte do
 * schema — sem isto ele a trata como tabela órfã e propõe DROP, o que apagaria
 * os inscritos. Não mexer no formato das colunas: precisa espelhar o que a rota
 * cria (created_at é timestamptz lá).
 */
export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Convites de teste (aba /admin/convites) ─────────────────────────────────
/**
 * Texto do convite, editável no admin. Fica em tabela (e não hardcoded) porque
 * o e-mail é o principal vetor de "cheiro de phishing": cada ajuste de tom no
 * assunto/corpo precisa ser feito sem deploy. `isDefault` marca o modelo que
 * abre pré-preenchido no formulário.
 */
export const inviteTemplates = pgTable("invite_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 200 }).notNull(),
  // Corpo em texto puro com placeholders {{nome}}, {{plano}}, {{dias}},
  // {{link}}, {{validade}}. O HTML é montado em src/lib/inviteEmail.ts a
  // partir daqui — o admin nunca escreve HTML.
  body: text("body").notNull(),
  // Versão curta para envio manual (WhatsApp/DM). Texto puro, mesmos
  // placeholders. Separada do corpo do e-mail de propósito: mensagem de
  // WhatsApp longa não é lida, e o rodapé/descadastro do e-mail não faz
  // sentido numa conversa em que a pessoa já sabe quem é você.
  shareBody: text("share_body"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Um convite = um e-mail para uma pessoa. O funil rastreado é
 * enviado → clicado → cadastrado (aceito) → primeiro uso, sem pixel de
 * abertura (decisão do produto: pixel é sinal clássico de spam e o Gmail/Apple
 * falseiam o dado de qualquer jeito).
 */
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  // Nulo quando o convite é do tipo "link": nesse caso o admin manda por
  // WhatsApp/mensagem e pode nem saber o e-mail da pessoa.
  email: varchar("email", { length: 255 }),
  name: varchar("name", { length: 255 }),
  // email = enviado por SMTP · link = texto gerado para envio manual
  channel: varchar("channel", { length: 10 }).notNull().default("email"),
  plan: varchar("plan", { length: 20 }).notNull().default("pro"), // pro | proband
  trialDays: integer("trial_days").notNull().default(20),
  // Quantas separações o convite libera no TOTAL do período de teste.
  // null = usa o limite padrão do plano (Pro 20 / Pro Band 40 por ciclo).
  trialSeparations: integer("trial_separations"),
  // Token de 48 hex chars — entra na URL /convite/<token>.
  token: varchar("token", { length: 96 }).notNull().unique(),
  // pending | sent | link | failed | clicked | accepted | expired | revoked
  // ("link" = texto gerado, aguardando o admin mandar pela mão)
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // Snapshot do que foi realmente enviado (o template pode mudar depois).
  subject: varchar("subject", { length: 200 }).notNull(),
  body: text("body").notNull(),
  error: text("error"),
  // Validade do CONVITE (link para de funcionar). Diferente de trialEndsAt,
  // que é a validade do acesso depois de aceito.
  expiresAt: timestamp("expires_at").notNull(),
  sentAt: timestamp("sent_at"),
  sendCount: integer("send_count").notNull().default(0),
  clickedAt: timestamp("clicked_at"),
  acceptedAt: timestamp("accepted_at"),
  firstUseAt: timestamp("first_use_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type Stem = typeof stems.$inferSelect;
export type NewStem = typeof stems.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Setlist = typeof setlists.$inferSelect;
export type NewSetlist = typeof setlists.$inferInsert;
export type SetlistSong = typeof setlistSongs.$inferSelect;
export type NewSetlistSong = typeof setlistSongs.$inferInsert;
export type SetlistComment = typeof setlistComments.$inferSelect;
export type NewSetlistComment = typeof setlistComments.$inferInsert;
export type Band = typeof bands.$inferSelect;
export type NewBand = typeof bands.$inferInsert;
export type BandMember = typeof bandMembers.$inferSelect;
export type NewBandMember = typeof bandMembers.$inferInsert;
export type SetlistSongMix = typeof setlistSongMix.$inferSelect;
export type NewSetlistSongMix = typeof setlistSongMix.$inferInsert;
export type SetlistSongMixUser = typeof setlistSongMixUser.$inferSelect;
export type NewSetlistSongMixUser = typeof setlistSongMixUser.$inferInsert;
export type SetlistEvent = typeof setlistEvents.$inferSelect;
export type NewSetlistEvent = typeof setlistEvents.$inferInsert;
export type SetlistEventAttendance = typeof setlistEventAttendance.$inferSelect;
export type NewSetlistEventAttendance = typeof setlistEventAttendance.$inferInsert;
export type SetlistEventItem = typeof setlistEventItems.$inferSelect;
export type NewSetlistEventItem = typeof setlistEventItems.$inferInsert;
export type SetlistAssignment = typeof setlistAssignments.$inferSelect;
export type NewSetlistAssignment = typeof setlistAssignments.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;
export type CifraEditHistory = typeof cifraEditHistory.$inferSelect;
export type NewCifraEditHistory = typeof cifraEditHistory.$inferInsert;
export type CifraReport = typeof cifraReports.$inferSelect;
export type NewCifraReport = typeof cifraReports.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type InviteTemplate = typeof inviteTemplates.$inferSelect;
export type NewInviteTemplate = typeof inviteTemplates.$inferInsert;
export type Waitlist = typeof waitlist.$inferSelect;

export interface ChordSection {
  section: string;    // "Verso" | "Refrão" | "Ponte" etc.
  timecode: number;   // segundos a partir do início
  chords: string;     // "Am G F E"
  times?: number[];   // tempo (s) de cada acorde em `chords` — cifra sobre a sílaba
}

export interface LyricsWord {
  text: string;   // a palavra
  start: number;  // segundos — início da palavra
  end: number;    // segundos — fim da palavra
}

export interface LyricsLine {
  time: number;   // segundos a partir do início (início da linha)
  text: string;   // texto da linha cantada
  // Tempo por palavra (WhisperX). Opcional: só existe em letras transcritas com
  // alinhamento por palavra — é o que permite posicionar o acorde sobre a sílaba
  // certa (cifra estilo CifraClub). Letras antigas (só linha) não têm.
  words?: LyricsWord[];
}
