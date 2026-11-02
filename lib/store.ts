import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export const types = {
  vente: { label: "Appel de vente", minutes: 45 },
  audit: { label: "Audit séminaire", minutes: 45 },
  suivi: { label: "Séance de suivi", minutes: 60 },
};
export type AppointmentType = keyof typeof types;
export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "client";
  active: number;
};
let instance: DatabaseSync;
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
export function db() {
  if (instance) return instance;
  const directory = process.env.DATA_DIRECTORY || join(process.cwd(), ".data");
  mkdirSync(directory, { recursive: true });
  instance = new DatabaseSync(join(directory, "seminaires.sqlite"));
  instance.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','client')), active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS slots(id INTEGER PRIMARY KEY, starts INTEGER NOT NULL UNIQUE, ends INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY, slot_id INTEGER NOT NULL UNIQUE REFERENCES slots(id), user_id INTEGER REFERENCES users(id), name TEXT NOT NULL, email TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('vente','audit','suivi')), completed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY, title TEXT NOT NULL, content BLOB NOT NULL, user_id INTEGER REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS login_attempts(email TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    email &&
    password &&
    password.length >= 12 &&
    !instance.prepare("SELECT id FROM users WHERE role=?").get("admin")
  ) {
    instance
      .prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)")
      .run("Gérant", email, hashPassword(password), "admin");
  }
  return instance;
}
export function currentUser(token?: string) {
  if (!token) return null;
  return (
    (db()
      .prepare(
        "SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>? AND u.active=1",
      )
      .get(tokenHash(token), Date.now()) as User | undefined) || null
  );
}
export function availableSlots(type: AppointmentType) {
  return db()
    .prepare(
      "SELECT s.id,s.starts,s.ends FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id WHERE a.id IS NULL AND s.starts>? AND s.ends-s.starts>=? ORDER BY s.starts LIMIT 100",
    )
    .all(Date.now(), types[type].minutes * 60000);
}
export function reserve(
  type: AppointmentType,
  slot: number,
  name: string,
  email: string,
  user: User | null,
) {
  if (type === "suivi" && user?.role !== "client")
    throw new Error(
      "Connectez-vous avec un compte client pour réserver un suivi.",
    );
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const available = database
      .prepare(
        "SELECT s.id FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id WHERE s.id=? AND a.id IS NULL AND s.starts>? AND s.ends-s.starts>=?",
      )
      .get(slot, Date.now(), types[type].minutes * 60000);
    if (!available)
      throw new Error(
        "Ce créneau n’est plus disponible. Choisissez-en un autre.",
      );
    const result = database
      .prepare(
        "INSERT INTO appointments(slot_id,user_id,name,email,type) VALUES(?,?,?,?,?)",
      )
      .run(
        slot,
        user?.id ?? null,
        user?.name ?? name,
        user?.email ?? email,
        type,
      );
    database.exec("COMMIT");
    return Number(result.lastInsertRowid);
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
