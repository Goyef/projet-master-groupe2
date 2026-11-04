import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";

import { appointments, loginAttempts, slots, waitlistEntries } from "@/db/schema";
import type { Locale } from "@/lib/i18n";
import { mailWaitlistSlotFreed } from "@/lib/mail/notifications";
import { AppError, db, tokenHash, types, type AppointmentType } from "@/lib/store";

// Liste d'attente « Prévenez-moi si un créneau se libère ». Une inscription (adresse + type)
// vaut pour une seule alerte et expire après 30 jours ; les inscriptions expirées sont
// supprimées au passage. Le jeton de désinscription n'est connu que par e-mail : seul son
// hash est stocké, et il change à chaque e-mail (le lien le plus récent fait foi).

export const WAITLIST_MS = 30 * 86400_000;
// Pas d'alerte pour un créneau qui commence dans moins de 2 heures.
export const WAITLIST_NOTICE_MS = 2 * 3600_000;
// Inscriptions acceptées par adresse et par quart d'heure (au-delà : ignorées, même réponse).
const WAITLIST_REQUESTS_MAX = 5;
const WAITLIST_WINDOW_MS = 15 * 60_000;
// Intervalle entre deux envois : l'API Resend limite le nombre de requêtes par seconde.
const SEND_INTERVAL_MS = 600;

const newToken = () => randomBytes(32).toString("base64url");
const active = (now: Date) => and(isNull(waitlistEntries.notifiedAt), gt(waitlistEntries.expires, now));

async function removeExpired(now: Date) {
  const database = await db();
  await database.delete(waitlistEntries).where(lt(waitlistEntries.expires, now));
}

// Limitation par adresse, sur le modèle du « mot de passe oublié » : vrai si la demande passe.
async function withinRate(email: string, now: Date) {
  const database = await db();
  const key = `waitlist:${email}`;
  const [attempts] = await database.select().from(loginAttempts).where(eq(loginAttempts.email, key));
  if (attempts && attempts.expires > now && attempts.count >= WAITLIST_REQUESTS_MAX) return false;
  const expires = new Date(now.getTime() + WAITLIST_WINDOW_MS);
  await database
    .insert(loginAttempts)
    .values({ email: key, count: 1, expires })
    .onConflictDoUpdate({
      target: loginAttempts.email,
      set: {
        count: sql`CASE WHEN ${loginAttempts.expires} > ${now} THEN ${loginAttempts.count} + 1 ELSE 1 END`,
        expires: sql`CASE WHEN ${loginAttempts.expires} > ${now} THEN ${loginAttempts.expires} ELSE ${expires} END`,
      },
    });
  return true;
}

// Inscription (ou réinscription : mise à jour de la langue, de l'échéance et du jeton, et
// nouvelle alerte si la précédente a déjà servi). Renvoie de quoi envoyer la confirmation,
// ou null si la limite de débit est atteinte : l'API répond pareil dans tous les cas.
export async function subscribeWaitlist(email: string, type: AppointmentType, locale: Locale) {
  const now = new Date();
  if (!(await withinRate(email, now))) return null;
  await removeExpired(now);
  const database = await db();
  const token = newToken();
  const expires = new Date(now.getTime() + WAITLIST_MS);
  const values = { locale, tokenHash: tokenHash(token), createdAt: now, expires, notifiedAt: null };
  await database
    .insert(waitlistEntries)
    .values({ email, type, ...values })
    .onConflictDoUpdate({ target: [waitlistEntries.email, waitlistEntries.type], set: values });
  return { email, type, locale, token, expires };
}

// Désinscription depuis le lien d'un e-mail : l'inscription est supprimée, le lien ne sert qu'une fois.
export async function unsubscribeWaitlist(token: string) {
  const database = await db();
  const [removed] = await database
    .delete(waitlistEntries)
    .where(and(eq(waitlistEntries.tokenHash, tokenHash(token)), gt(waitlistEntries.expires, new Date())))
    .returning({ id: waitlistEntries.id });
  if (!removed) throw new AppError("waitlistLinkInvalid", 400);
}

// Gérant : personnes en attente d'une alerte, par type de rendez-vous.
export async function waitlistCounts() {
  const database = await db();
  const rows = await database
    .select({ type: waitlistEntries.type, total: count() })
    .from(waitlistEntries)
    .where(active(new Date()))
    .groupBy(waitlistEntries.type);
  const counts: Record<AppointmentType, number> = { vente: 0, audit: 0, suivi: 0 };
  for (const row of rows) counts[row.type] = row.total;
  return counts;
}

// Prévient les inscrits quand des créneaux de [from, to) redeviennent réservables (annulation,
// déplacement, suppression d'un rendez-vous, nouvelles disponibilités). Appelée après la réponse :
// seuls les créneaux encore libres et commençant dans plus de 2 heures comptent. Chaque inscription
// est marquée prévenue avant l'envoi, par une mise à jour conditionnelle : deux libérations
// simultanées ne préviennent pas deux fois la même personne.
export async function notifyWaitlist(from: Date, to: Date, site: string) {
  const now = new Date();
  const earliest = new Date(now.getTime() + WAITLIST_NOTICE_MS);
  const database = await db();
  const freed = await database
    .select({ starts: slots.starts, ends: slots.ends })
    .from(slots)
    .where(
      and(
        gte(slots.starts, from),
        lt(slots.starts, to),
        gt(slots.starts, earliest),
        sql`NOT EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.slotId} = ${slots.id})`,
      ),
    )
    .orderBy(asc(slots.starts));
  if (!freed.length) return;
  await removeExpired(now);
  let sent = 0;
  for (const type of Object.keys(types) as AppointmentType[]) {
    const fitting = freed
      .filter((slot) => slot.ends.getTime() - slot.starts.getTime() >= types[type].minutes * 60_000)
      .map((slot) => slot.starts);
    if (!fitting.length) continue;
    const waiting = await database
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(and(eq(waitlistEntries.type, type), active(now)))
      .orderBy(asc(waitlistEntries.createdAt));
    for (const { id } of waiting) {
      const token = newToken();
      const [entry] = await database
        .update(waitlistEntries)
        .set({ notifiedAt: new Date(), tokenHash: tokenHash(token) })
        .where(and(eq(waitlistEntries.id, id), active(now)))
        .returning({ email: waitlistEntries.email, locale: waitlistEntries.locale });
      if (!entry) continue;
      if (sent++) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
      // Un échec d'envoi est journalisé par sendMail ; l'inscription reste consommée.
      await mailWaitlistSlotFreed({ ...entry, type }, token, fitting, site).catch((error) =>
        console.error("[liste d'attente] e-mail impossible :", error),
      );
    }
  }
}
