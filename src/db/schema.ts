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
  // Thumbnail opcional
  thumbnailUrl: text("thumbnail_url"),
  // Visível no catálogo?
  published: boolean("published").notNull().default(false),
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
  role: varchar("role", { length: 20 }).notNull().default("free"), // free | pro | admin
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

export interface ChordSection {
  section: string;    // "Verso" | "Refrão" | "Ponte" etc.
  timecode: number;   // segundos a partir do início
  chords: string;     // "Am G F E"
}
