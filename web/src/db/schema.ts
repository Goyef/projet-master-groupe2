import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
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
    starts: moment("starts").notNull(),
    ends: moment("ends").notNull(),
    completed: boolean("completed").notNull().default(false),
    // Un rendez-vous annulé libère son créneau (slot_id remis à NULL) mais reste dans l'historique.
    status: text("status", { enum: ["confirmed", "cancelled"] })
      .notNull()
      .default("confirmed"),
    cancelledAt: moment("cancelled_at"),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (table) => [index("appointments_starts_idx").on(table.starts)],
);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: bytea("content").notNull(),
  userId: integer("user_id").references(() => users.id, {
    onDelete: "cascade",
  }),
  // Parcours : nombre de séances réalisées nécessaires pour y accéder (0 = tout de suite).
  requiredSessions: integer("required_sessions").notNull().default(0),
});

export const loginAttempts = pgTable("login_attempts", {
  email: text("email").primaryKey(),
  count: integer("count").notNull(),
  expires: moment("expires").notNull(),
});
