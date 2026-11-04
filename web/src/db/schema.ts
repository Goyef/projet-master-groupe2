import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

const moment = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Renseigné à la création des comptes clients ; vide pour le compte gérant.
  phone: text("phone"),
  password: text("password").notNull(),
  // Mot de passe provisoire choisi à la création par le gérant : le client est invité à le changer.
  passwordTemporary: boolean("password_temporary").notNull().default(false),
  role: text("role", { enum: ["admin", "client"] }).notNull(),
  active: boolean("active").notNull().default(true),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: moment("expires").notNull(),
});

export const slots = pgTable("slots", {
  id: serial("id").primaryKey(),
  starts: moment("starts").notNull().unique(),
  ends: moment("ends").notNull(),
});

export const appointments = pgTable(
  "appointments",
  {
    id: serial("id").primaryKey(),
    slotId: integer("slot_id")
      .unique()
      .references(() => slots.id, { onDelete: "set null" }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type", { enum: ["vente", "audit", "suivi"] }).notNull(),
    format: text("format", { enum: ["visio", "presentiel"] })
      .notNull()
      .default("visio"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    intention: text("intention").notNull(),
    // « Ce que j'aimerais aborder » : écrit par le client avant la séance, modifiable jusqu'au début.
    preparation: text("preparation"),
    starts: moment("starts").notNull(),
    ends: moment("ends").notNull(),
    completed: boolean("completed").notNull().default(false),
    // Un rendez-vous annulé libère son créneau (slot_id remis à NULL) mais reste dans l'historique.
    status: text("status", { enum: ["confirmed", "cancelled"] })
      .notNull()
      .default("confirmed"),
    cancelledAt: moment("cancelled_at"),
    // Lien Google Meet créé avec l'événement Google Agenda (visio, synchronisation OAuth).
    meetUrl: text("meet_url"),
    // Langue de l'interface à la réservation (ou au dernier déplacement par le client),
    // utilisée pour les e-mails envoyés hors requête (rappel de la veille).
    locale: text("locale", { enum: ["fr", "en"] }).notNull().default("fr"),
    // Rappel de la veille déjà parti (ou en cours d'envoi) ; remis à NULL au déplacement.
    reminderSentAt: moment("reminder_sent_at"),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (table) => [index("appointments_starts_idx").on(table.starts)],
);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: bytea("content").notNull(),
  // Partagé avec tous les clients ; sinon, seulement avec ceux de `document_recipients`.
  allClients: boolean("all_clients").notNull().default(false),
  // Parcours : nombre de séances réalisées nécessaires pour y accéder (0 = tout de suite).
  requiredSessions: integer("required_sessions").notNull().default(0),
});

// Clients destinataires d'un document partagé avec certains clients seulement.
export const documentRecipients = pgTable(
  "document_recipients",
  {
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.userId] }),
    index("document_recipients_user_idx").on(table.userId),
  ],
);

// Liens « mot de passe oublié » et « choisir mon mot de passe » : seul le hash du jeton
// est stocké ; un lien expire et ne sert qu'une fois.
export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: moment("expires").notNull(),
  },
  (table) => [index("password_resets_user_idx").on(table.userId)],
);

export const loginAttempts = pgTable("login_attempts", {
  email: text("email").primaryKey(),
  count: integer("count").notNull(),
  expires: moment("expires").notNull(),
});

// Espace de tickets : demandes de support déposées par les clients, traitées par le gérant.
export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "in_progress", "closed"] })
      .notNull()
      .default("open"),
    createdAt: moment("created_at").notNull().defaultNow(),
    updatedAt: moment("updated_at").notNull().defaultNow(),
    closedAt: moment("closed_at"),
  },
  (table) => [index("tickets_user_idx").on(table.userId)],
);

export const ticketReplies = pgTable(
  "ticket_replies",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (table) => [index("ticket_replies_ticket_idx").on(table.ticketId)],
);

// Compte rendu de séance rédigé par le gérant (un par rendez-vous réalisé d'un client avec compte).
export const sessionNotes = pgTable("session_notes", {
  appointmentId: integer("appointment_id")
    .primaryKey()
    .references(() => appointments.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  // Première publication : seule celle-ci déclenche l'e-mail au client.
  publishedAt: moment("published_at").notNull().defaultNow(),
  updatedAt: moment("updated_at").notNull().defaultNow(),
});

// Actions à faire d'ici la prochaine séance (5 au plus), cochées par le client.
export const sessionActions = pgTable(
  "session_actions",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => sessionNotes.appointmentId, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: moment("done_at"),
  },
  (table) => [index("session_actions_appointment_idx").on(table.appointmentId)],
);

// Liste d'attente « Prévenez-moi si un créneau se libère » : une inscription par adresse et par
// type, qui vaut pour une seule alerte (`notified_at`) et expire après 30 jours. Seul le hash
// du jeton de désinscription est stocké, comme pour `password_resets`.
export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    type: text("type", { enum: ["vente", "audit", "suivi"] }).notNull(),
    // Langue de l'inscription, reprise dans les e-mails.
    locale: text("locale", { enum: ["fr", "en"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: moment("created_at").notNull().defaultNow(),
    expires: moment("expires").notNull(),
    notifiedAt: moment("notified_at"),
  },
  (table) => [uniqueIndex("waitlist_entries_email_type_idx").on(table.email, table.type)],
);

// Journal d'humeur (« météo intérieure ») : une entrée par client et par jour (date de Paris).
// Visible par le client et par le gérant uniquement ; jamais repris dans un e-mail ni un agenda.
export const moodEntries = pgTable(
  "mood_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    // 1 orage, 2 pluie, 3 nuageux, 4 éclaircies, 5 soleil.
    mood: integer("mood").notNull(),
    note: text("note"),
    updatedAt: moment("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("mood_entries_user_day_unique").on(table.userId, table.day),
    check("mood_entries_mood_check", sql`${table.mood} BETWEEN 1 AND 5`),
  ],
);
