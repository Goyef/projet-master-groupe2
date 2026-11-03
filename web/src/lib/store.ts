import "server-only";
import { join } from "node:path";
import {
  createHash,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "@/db/schema";
import {
  appointments,
  documents,
  loginAttempts,
  sessions,
  slots,
  ticketReplies,
  tickets,
  users,
} from "@/db/schema";

export const types = {
  vente: { minutes: 45 },
  audit: { minutes: 45 },
  suivi: { minutes: 60 },
};
export type AppointmentType = keyof typeof types;
export type MeetingFormat = "visio" | "presentiel";
export const TICKET_STATUSES = ["open", "in_progress", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "client";
  active: boolean;
  passwordTemporary: boolean;
};

// Erreur métier : `code` correspond à une clé de traduction (dictionnaire `errors`).
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    // Précision technique (champ fautif…), journalisée en développement uniquement.
    public detail?: string,
  ) {
    super(code);
  }
}

const DEFAULT_URL = "postgres://synego:synego@localhost:5432/synego";
const globalForDb = globalThis as unknown as {
  synegoDb?: ReturnType<typeof drizzle<typeof schema>>;
  synegoReady?: Promise<void>;
};

function connection() {
  globalForDb.synegoDb ??= drizzle(
    new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_URL }),
    { schema },
  );
  return globalForDb.synegoDb;
}

// Applique les migrations et crée le compte gérant au premier accès.
export async function db() {
  const database = connection();
  globalForDb.synegoReady ??= (async () => {
    await migrate(database, {
      migrationsFolder: join(process.cwd(), "drizzle"),
    });
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password && password.length >= 12) {
      const [admin] = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
      if (!admin)
        await database.insert(users).values({
          name: "Youcef",
          email,
          password: hashPassword(password),
          role: "admin",
        });
    }
  })().catch((error) => {
    globalForDb.synegoReady = undefined;
    throw error;
  });
  await globalForDb.synegoReady;
  return database;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  return Boolean(
    salt &&
      key &&
      timingSafeEqual(Buffer.from(key, "hex"), scryptSync(password, salt, 64)),
  );
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function isUniqueViolation(error: unknown) {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return (
    (error as { code?: string })?.code === "23505" || cause?.code === "23505"
  );
}

export async function currentUser(token?: string): Promise<User | null> {
  if (!token) return null;
  const database = await db();
  const [user] = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      active: users.active,
      passwordTemporary: users.passwordTemporary,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.token, tokenHash(token)),
        gt(sessions.expires, new Date()),
        eq(users.active, true),
      ),
    );
  return user ?? null;
}

const freeSlot = (minutes: number) =>
  and(
    gt(slots.starts, new Date()),
    sql`${slots.ends} - ${slots.starts} >= make_interval(mins => ${minutes})`,
    sql`NOT EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.slotId} = ${slots.id})`,
  );

export async function availableSlots(type: AppointmentType) {
  const database = await db();
  const rows = await database
    .select({ id: slots.id, starts: slots.starts, ends: slots.ends })
    .from(slots)
    .where(freeSlot(types[type].minutes))
    .orderBy(asc(slots.starts))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    starts: row.starts.getTime(),
    ends: row.ends.getTime(),
  }));
}

export type BookingInput = {
  type: AppointmentType;
  slotId: number;
  format: MeetingFormat;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  intention: string;
  user: User | null;
};

// Réserve un créneau. L'unicité de slot_id empêche deux réservations concurrentes.
export async function reserve(input: BookingInput) {
  if (input.type === "suivi" && input.user?.role !== "client")
    throw new AppError("clientRequired", 401);
  const database = await db();
  const [slot] = await database
    .select()
    .from(slots)
    .where(and(eq(slots.id, input.slotId), freeSlot(types[input.type].minutes)));
  if (!slot) throw new AppError("slotTaken", 409);
  try {
    const [created] = await database
      .insert(appointments)
      .values({
        slotId: slot.id,
        userId: input.user?.id ?? null,
        type: input.type,
        format: input.format,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        intention: input.intention,
        starts: slot.starts,
        ends: new Date(
          slot.starts.getTime() + types[input.type].minutes * 60_000,
        ),
      })
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("slotTaken", 409);
    throw error;
  }
}

// --- Espace connecté -------------------------------------------------------

// Délai minimal pour annuler ou déplacer un rendez-vous depuis l'espace client.
export const CHANGE_NOTICE_MS = 24 * 3600_000;

export async function listAppointments(user: User) {
  const database = await db();
  const rows = await database
    .select()
    .from(appointments)
    .where(user.role === "admin" ? undefined : eq(appointments.userId, user.id))
    .orderBy(desc(appointments.starts));
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    format: row.format,
    status: row.status,
    name: `${row.firstName} ${row.lastName}`.trim(),
    email: row.email,
    phone: user.role === "admin" ? row.phone : undefined,
    intention: user.role === "admin" ? row.intention : undefined,
    completed: row.completed,
    past: row.starts.getTime() < now,
    starts: row.starts.getTime(),
    ends: row.ends.getTime(),
    // Le client peut encore annuler ou déplacer ce rendez-vous lui-même.
    changeable:
      user.role === "client" &&
      row.status === "confirmed" &&
      row.starts.getTime() - now > CHANGE_NOTICE_MS,
  }));
}

// Rendez-vous du client encore modifiable ; sinon, l'erreur explique pourquoi.
async function changeableAppointment(user: User, id: number) {
  const database = await db();
  const [row] = await database
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.userId, user.id)));
  if (!row) throw new AppError("appointmentNotFound", 404);
  if (row.status === "cancelled") throw new AppError("alreadyCancelled", 409);
  if (row.starts.getTime() - Date.now() <= CHANGE_NOTICE_MS)
    throw new AppError("tooLateToChange", 409);
  return row;
}

// Les conditions sont répétées dans la requête pour rester sûres face à deux demandes simultanées.
const stillChangeable = (user: User, id: number) =>
  and(
    eq(appointments.id, id),
    eq(appointments.userId, user.id),
    eq(appointments.status, "confirmed"),
    gt(appointments.starts, new Date(Date.now() + CHANGE_NOTICE_MS)),
  );

// Annule le rendez-vous et libère son créneau pour une autre réservation.
export async function cancelAppointment(user: User, id: number) {
  await changeableAppointment(user, id);
  const database = await db();
  const updated = await database
    .update(appointments)
    .set({ status: "cancelled", slotId: null, cancelledAt: new Date() })
    .where(stillChangeable(user, id))
    .returning({ id: appointments.id });
  if (!updated.length) throw new AppError("tooLateToChange", 409);
}

// Déplace le rendez-vous vers un autre créneau libre ; l'ancien créneau redevient disponible.
export async function rescheduleAppointment(user: User, id: number, slotId: number) {
  const current = await changeableAppointment(user, id);
  const database = await db();
  const minutes = types[current.type].minutes;
  const [slot] = await database
    .select()
    .from(slots)
    .where(and(eq(slots.id, slotId), freeSlot(minutes)));
  if (!slot) throw new AppError("slotTaken", 409);
  if (slot.starts.getTime() - Date.now() <= CHANGE_NOTICE_MS)
    throw new AppError("slotTooSoon", 409);
  try {
    const [updated] = await database
      .update(appointments)
      .set({
        slotId: slot.id,
        starts: slot.starts,
        ends: new Date(slot.starts.getTime() + minutes * 60_000),
      })
      .where(stillChangeable(user, id))
      .returning({ starts: appointments.starts });
    if (!updated) throw new AppError("tooLateToChange", 409);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("slotTaken", 409);
    throw error;
  }
}

export async function updateProfile(user: User, name: string, phone: string) {
  const database = await db();
  await database.update(users).set({ name, phone }).where(eq(users.id, user.id));
}

// Change le mot de passe et ferme les autres sessions ouvertes du compte.
export async function changePassword(
  user: User,
  token: string,
  current: string,
  next: string,
) {
  const database = await db();
  const [account] = await database
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, user.id));
  if (!account || !verifyPassword(current, account.password))
    throw new AppError("wrongPassword", 400);
  await database
    .update(users)
    .set({ password: hashPassword(next), passwordTemporary: false })
    .where(eq(users.id, user.id));
  await database
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, user.id),
        sql`${sessions.token} <> ${tokenHash(token)}`,
      ),
    );
}

// Types de rendez-vous qui comptent comme une séance du parcours client.
const SESSION_TYPES: AppointmentType[] = ["suivi"];
export const MAX_REQUIRED_SESSIONS = 50;

// Séances réalisées par le client : rendez-vous confirmés que le gérant a marqués « réalisés ».
export async function completedSessions(userId: number) {
  const database = await db();
  const [row] = await database
    .select({ total: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        eq(appointments.completed, true),
        eq(appointments.status, "confirmed"),
        inArray(appointments.type, SESSION_TYPES),
      ),
    );
  return row?.total ?? 0;
}

const visibleTo = (user: User) =>
  user.role === "admin"
    ? undefined
    : sql`(${documents.userId} IS NULL OR ${documents.userId} = ${user.id})`;

// Le gérant voit tout ; le client voit aussi les documents encore verrouillés, sans pouvoir les ouvrir.
export async function listDocuments(user: User) {
  const database = await db();
  const rows = await database
    .select({
      id: documents.id,
      title: documents.title,
      user_id: documents.userId,
      required_sessions: documents.requiredSessions,
    })
    .from(documents)
    .where(visibleTo(user))
    .orderBy(asc(documents.requiredSessions), asc(documents.id));
  const done = user.role === "admin" ? Infinity : await completedSessions(user.id);
  return rows.map((row) => ({ ...row, unlocked: row.required_sessions <= done }));
}

// Contenu du document, ou `locked` si le client n'a pas encore réalisé assez de séances.
export async function getDocument(user: User, id: number) {
  const database = await db();
  const [document] = await database
    .select({ content: documents.content, requiredSessions: documents.requiredSessions })
    .from(documents)
    .where(and(eq(documents.id, id), visibleTo(user)));
  if (!document) return null;
  if (
    user.role !== "admin" &&
    document.requiredSessions > (await completedSessions(user.id))
  )
    throw new AppError("documentLocked", 403);
  return document;
}

export async function listClients() {
  const database = await db();
  return database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      active: users.active,
      passwordTemporary: users.passwordTemporary,
    })
    .from(users)
    .where(eq(users.role, "client"))
    .orderBy(asc(users.name));
}

export async function listUpcomingSlots() {
  const database = await db();
  const rows = await database
    .select({
      id: slots.id,
      starts: slots.starts,
      ends: slots.ends,
      appointment_id: appointments.id,
    })
    .from(slots)
    .leftJoin(appointments, eq(appointments.slotId, slots.id))
    .where(gt(slots.starts, new Date()))
    .orderBy(asc(slots.starts));
  return rows.map((row) => ({
    ...row,
    starts: row.starts.getTime(),
    ends: row.ends.getTime(),
  }));
}

export const SLOT_LENGTHS = [45, 60] as const;
export type SlotLength = (typeof SLOT_LENGTHS)[number];

// Découpe une plage (ex. 9 h – 18 h) en créneaux consécutifs de `minutes`.
// Les créneaux qui chevaucheraient une disponibilité existante sont ignorés.
export async function addSlotRange(starts: Date, ends: Date, minutes: SlotLength) {
  const step = minutes * 60_000;
  const wanted: { starts: Date; ends: Date }[] = [];
  for (let time = starts.getTime(); time + step <= ends.getTime(); time += step)
    wanted.push({ starts: new Date(time), ends: new Date(time + step) });
  if (!wanted.length) throw new AppError("slotInvalid");

  const database = await db();
  return database.transaction(async (tx) => {
    // Verrou applicatif : sérialise les ajouts pour empêcher deux créneaux qui se chevauchent.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(4242)`);
    const existing = await tx
      .select({ starts: slots.starts, ends: slots.ends })
      .from(slots)
      .where(and(lt(slots.starts, ends), gt(slots.ends, starts)));
    const free = wanted.filter(
      (slot) =>
        !existing.some(
          (other) => other.starts < slot.ends && other.ends > slot.starts,
        ),
    );
    if (!free.length) throw new AppError("slotOverlap", 409);
    await tx.insert(slots).values(free);
    return { added: free.length, skipped: wanted.length - free.length };
  });
}

export async function removeSlot(id: number) {
  const database = await db();
  const removed = await database
    .delete(slots)
    .where(
      and(
        eq(slots.id, id),
        sql`NOT EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.slotId} = ${slots.id})`,
      ),
    )
    .returning({ id: slots.id });
  if (!removed.length) throw new AppError("slotNotRemovable", 409);
}

export async function toggleCompleted(id: number) {
  const database = await db();
  const updated = await database
    .update(appointments)
    .set({ completed: sql`NOT ${appointments.completed}` })
    .where(
      and(
        eq(appointments.id, id),
        eq(appointments.status, "confirmed"),
        lt(appointments.starts, new Date()),
      ),
    )
    .returning({ id: appointments.id });
  if (!updated.length) throw new AppError("notStartedYet", 409);
}

// Inscription libre d'un client depuis /connexion : le compte est actif tout de suite
// et la session ouverte. Le mot de passe est choisi par le client (pas provisoire).
export async function registerClient(
  name: string,
  email: string,
  phone: string,
  password: string,
) {
  const database = await db();
  try {
    const [account] = await database
      .insert(users)
      .values({ name, email, phone, password: hashPassword(password), role: "client" })
      .returning({ id: users.id });
    return createSession(account.id);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("emailTaken", 409);
    throw error;
  }
}

// Mot de passe provisoire lisible à transmettre au client, ex. « K7QM-4XRT-9WHP-2NCF ».
// Alphabet sans caractères ambigus (0/O, 1/I/L) : 4 groupes de 4, soit environ 80 bits d'entropie.
const TEMPORARY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function temporaryPassword() {
  const groups = Array.from({ length: 4 }, () =>
    Array.from(
      { length: 4 },
      () => TEMPORARY_ALPHABET[randomInt(TEMPORARY_ALPHABET.length)],
    ).join(""),
  );
  return groups.join("-");
}

// Création d'un compte client par le gérant. Le mot de passe provisoire n'est renvoyé
// qu'une fois, en clair, pour être transmis au client ; seul son hash est conservé.
export async function createClient(name: string, email: string, phone: string) {
  const database = await db();
  const password = temporaryPassword();
  try {
    await database.insert(users).values({
      name,
      email,
      phone,
      password: hashPassword(password),
      passwordTemporary: true,
      role: "client",
    });
    return password;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("emailTaken", 409);
    throw error;
  }
}

// Nouveau mot de passe provisoire (client qui a perdu le sien) : ses sessions sont fermées.
export async function resetClientPassword(id: number) {
  const database = await db();
  const password = temporaryPassword();
  const updated = await database
    .update(users)
    .set({ password: hashPassword(password), passwordTemporary: true })
    .where(and(eq(users.id, id), eq(users.role, "client")))
    .returning({ id: users.id });
  if (!updated.length) throw new AppError("clientNotFound", 404);
  await database.delete(sessions).where(eq(sessions.userId, id));
  return password;
}

export async function toggleClient(id: number) {
  const database = await db();
  await database
    .update(users)
    .set({ active: sql`NOT ${users.active}` })
    .where(and(eq(users.id, id), eq(users.role, "client")));
  await database.delete(sessions).where(eq(sessions.userId, id));
}

export async function addDocument(
  title: string,
  content: Buffer,
  recipient: number | null,
  requiredSessions = 0,
) {
  const database = await db();
  if (recipient) {
    const [client] = await database
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, recipient), eq(users.role, "client")));
    if (!client) throw new AppError("clientNotFound", 404);
  }
  await database
    .insert(documents)
    .values({ title, content, userId: recipient, requiredSessions });
}

export async function removeDocument(id: number) {
  const database = await db();
  await database.delete(documents).where(eq(documents.id, id));
}

// --- Demandes de support ---------------------------------------------------

// Le client ne voit que ses demandes ; le gérant les voit toutes, avec le nom du client.
export async function listTickets(user: User) {
  const database = await db();
  const rows = await database
    .select({
      id: tickets.id,
      subject: tickets.subject,
      message: tickets.message,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      closedAt: tickets.closedAt,
      userId: tickets.userId,
      name: users.name,
      email: users.email,
    })
    .from(tickets)
    .innerJoin(users, eq(users.id, tickets.userId))
    .where(user.role === "admin" ? undefined : eq(tickets.userId, user.id))
    .orderBy(desc(tickets.updatedAt));
  const replies = rows.length
    ? await database
        .select()
        .from(ticketReplies)
        .where(inArray(ticketReplies.ticketId, rows.map((row) => row.id)))
        .orderBy(asc(ticketReplies.createdAt))
    : [];
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    closedAt: row.closedAt?.getTime() ?? null,
    ...(user.role === "admin" ? { userId: row.userId, name: row.name, email: row.email } : {}),
    replies: replies
      .filter((reply) => reply.ticketId === row.id)
      .map((reply) => ({ id: reply.id, message: reply.message, createdAt: reply.createdAt.getTime() })),
  }));
}

export async function createTicket(user: User, subject: string, message: string) {
  const database = await db();
  const [created] = await database
    .insert(tickets)
    .values({ userId: user.id, subject, message })
    .returning({ id: tickets.id });
  return created;
}

// Réponse du gérant : une demande ouverte passe automatiquement « en cours ».
export async function replyTicket(id: number, message: string) {
  const database = await db();
  return database.transaction(async (tx) => {
    const [ticket] = await tx
      .update(tickets)
      .set({
        status: sql`CASE WHEN ${tickets.status} = 'open' THEN 'in_progress' ELSE ${tickets.status} END`,
        updatedAt: new Date(),
      })
      .where(and(eq(tickets.id, id), sql`${tickets.status} <> 'closed'`))
      .returning({ id: tickets.id });
    if (!ticket) {
      const [exists] = await tx.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, id));
      throw exists ? new AppError("ticketClosed", 409) : new AppError("ticketNotFound", 404);
    }
    await tx.insert(ticketReplies).values({ ticketId: id, message });
  });
}

export async function setTicketStatus(id: number, status: TicketStatus) {
  const database = await db();
  const now = new Date();
  const updated = await database
    .update(tickets)
    .set({ status, updatedAt: now, closedAt: status === "closed" ? now : null })
    .where(eq(tickets.id, id))
    .returning({ id: tickets.id });
  if (!updated.length) throw new AppError("ticketNotFound", 404);
}

// --- Connexion -------------------------------------------------------------

const ATTEMPT_WINDOW_MS = 15 * 60_000;

export async function login(email: string, password: string) {
  const database = await db();
  const now = new Date();
  const [attempts] = await database
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, email));
  if (attempts && attempts.expires > now && attempts.count >= 8)
    throw new AppError("tooManyAttempts", 429);
  const [account] = await database
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.active, true)));
  if (!account || !verifyPassword(password, account.password)) {
    const expires = new Date(now.getTime() + ATTEMPT_WINDOW_MS);
    await database
      .insert(loginAttempts)
      .values({ email, count: 1, expires })
      .onConflictDoUpdate({
        target: loginAttempts.email,
        set: {
          count: sql`CASE WHEN ${loginAttempts.expires} > ${now} THEN ${loginAttempts.count} + 1 ELSE 1 END`,
          expires,
        },
      });
    throw new AppError("badCredentials", 401);
  }
  await database.delete(loginAttempts).where(eq(loginAttempts.email, email));
  return createSession(account.id);
}

// Ouvre une session de 8 heures ; seul le hash du jeton est stocké.
async function createSession(userId: number) {
  const database = await db();
  const token = randomBytes(32).toString("hex");
  await database.insert(sessions).values({
    token: tokenHash(token),
    userId,
    expires: new Date(Date.now() + 8 * 3600_000),
  });
  return token;
}

export async function logout(token: string) {
  const database = await db();
  await database.delete(sessions).where(eq(sessions.token, tokenHash(token)));
}
