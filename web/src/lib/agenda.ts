import "server-only";
import { createHash, createSign, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt } from "drizzle-orm";

import { texts } from "@/content/texts";
import { appointments } from "@/db/schema";
import { appointmentUid, type CalendarEvent } from "@/lib/calendar";
import { format } from "@/lib/format";
import { db, types } from "@/lib/store";

// Agenda du gérant : flux d'abonnement iCalendar et synchronisation avec Google Agenda.
// L'intention (« ce qui vous amène ») n'est jamais transmise : elle reste dans l'espace gérant.

type AppointmentRow = typeof appointments.$inferSelect;

// Adresse publique du site (SITE_URL, sinon celle de la requête), reprise dans les événements.
export function siteUrl(requestOrigin: string) {
  return (process.env.SITE_URL || requestOrigin).replace(/\/$/, "");
}

function adminEvent(row: AppointmentRow, site: string): CalendarEvent {
  const values = {
    type: texts.types[row.type],
    name: `${row.firstName} ${row.lastName}`.trim(),
    minutes: types[row.type].minutes,
    format: texts.formats[row.format],
    email: row.email,
    phone: row.phone,
    url: `${site}/connexion`,
  };
  return {
    uid: appointmentUid(row.id),
    title: format(texts.calendar.adminTitle, values),
    description: format(texts.calendar.adminDescription, values),
    location: texts.formats[row.format],
    starts: row.starts.getTime(),
    ends: row.ends.getTime(),
  };
}

// --- Flux d'abonnement -------------------------------------------------------

// Jeton secret du lien d'abonnement (au moins 32 caractères) ; absent = flux désactivé.
function feedToken() {
  const token = process.env.CALENDAR_FEED_TOKEN?.trim();
  return token && token.length >= 32 ? token : null;
}

export function feedPath() {
  const token = feedToken();
  return token ? `/api/agenda/${token}` : null;
}

export function isFeedToken(candidate: string) {
  const token = feedToken();
  if (!token) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(token));
}

// Rendez-vous confirmés des 30 derniers jours et à venir.
export async function feedEvents(site: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "confirmed"),
        gt(appointments.starts, new Date(Date.now() - 30 * 86400_000)),
      ),
    )
    .orderBy(asc(appointments.starts));
  return rows.map((row) => adminEvent(row, site));
}

// --- Synchronisation Google Agenda ------------------------------------------

// Compte de service Google : l'agenda de Youcef doit être partagé avec son adresse
// (« Modifier les événements »). Les URL sont paramétrables pour les tests.
function googleConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!calendarId || !clientEmail || !privateKey) return null;
  return {
    calendarId,
    clientEmail,
    privateKey,
    apiUrl: process.env.GOOGLE_CALENDAR_API_URL || "https://www.googleapis.com/calendar/v3",
    tokenUrl: process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  };
}

export const googleSyncEnabled = () => googleConfig() !== null;

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const tokenCache = globalThis as unknown as { synegoGoogleToken?: { value: string; expires: number } };

// Jeton d'accès OAuth obtenu avec une assertion JWT signée par la clé du compte de service.
async function accessToken(config: NonNullable<ReturnType<typeof googleConfig>>) {
  const cached = tokenCache.synegoGoogleToken;
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: config.tokenUrl,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.privateKey);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`jeton Google refusé (${response.status})`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.synegoGoogleToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Identifiant d'événement Google déduit de l'identifiant du rendez-vous (caractères a-v et 0-9) :
// pas besoin de le stocker, et une nouvelle tentative ne crée pas de doublon.
const googleEventId = (id: number) => `rdv${String(id).padStart(6, "0")}`;

// Reporte l'état d'un rendez-vous dans Google Agenda : création, mise à jour ou suppression.
// Appelée après la réponse (`after`) : une panne de Google ne bloque jamais une réservation.
export async function syncAppointment(id: number, site: string) {
  const config = googleConfig();
  if (!config) return;
  try {
    const database = await db();
    const [row] = await database.select().from(appointments).where(eq(appointments.id, id));
    if (!row) return;
    const token = await accessToken(config);
    const events = `${config.apiUrl}/calendars/${encodeURIComponent(config.calendarId)}/events`;
    const eventId = googleEventId(row.id);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    if (row.status === "cancelled") {
      const removed = await fetch(`${events}/${eventId}`, { method: "DELETE", headers });
      // 404 / 410 : l'événement n'existait pas ou a déjà été supprimé.
      if (!removed.ok && removed.status !== 404 && removed.status !== 410)
        throw new Error(`suppression refusée (${removed.status})`);
      return;
    }

    const event = adminEvent(row, site);
    const body = JSON.stringify({
      id: eventId,
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: row.starts.toISOString(), timeZone: "Europe/Paris" },
      end: { dateTime: row.ends.toISOString(), timeZone: "Europe/Paris" },
      // Le client n'est pas invité : Google ne lui envoie aucun e-mail.
      reminders: { useDefault: true },
    });
    const updated = await fetch(`${events}/${eventId}`, { method: "PUT", headers, body });
    if (updated.ok) return;
    if (updated.status !== 404) throw new Error(`mise à jour refusée (${updated.status})`);
    const created = await fetch(events, { method: "POST", headers, body });
    if (!created.ok) throw new Error(`création refusée (${created.status})`);
  } catch (error) {
    console.error(`[agenda] synchronisation Google du rendez-vous ${id} impossible :`, error);
  }
}
