import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  varchar,
  jsonb,
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;
export type CifraEditHistory = typeof cifraEditHistory.$inferSelect;
export type NewCifraEditHistory = typeof cifraEditHistory.$inferInsert;
export type CifraReport = typeof cifraReports.$inferSelect;
export type NewCifraReport = typeof cifraReports.$inferInsert;

export interface ChordSection {
  section: string;    // "Verso" | "Refrão" | "Ponte" etc.
  timecode: number;   // segundos a partir do início
  chords: string;     // "Am G F E"
}

export interface LyricsLine {
  time: number;   // segundos a partir do início (início da linha)
  text: string;   // texto da linha cantada
}
