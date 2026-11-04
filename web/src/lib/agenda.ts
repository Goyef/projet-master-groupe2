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
    location: row.meetUrl ?? texts.formats[row.format],
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

// Deux connexions possibles, au choix (les URL sont paramétrables pour les tests) :
// - OAuth avec le compte Google de Youcef (jeton de rafraîchissement) : les événements sont
//   créés en son nom, avec un lien Google Meet pour chaque visio ;
// - compte de service à qui l'agenda est partagé (« Modifier les événements ») : Google
//   lui refuse la création de visioconférences, donc pas de lien Meet.
function googleConfig() {
  const apiUrl = process.env.GOOGLE_CALENDAR_API_URL || "https://www.googleapis.com/calendar/v3";
  const tokenUrl = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (clientId && clientSecret && refreshToken)
    return {
      auth: { kind: "oauth" as const, clientId, clientSecret, refreshToken },
      // Sans identifiant, l'agenda principal du compte connecté.
      calendarId: calendarId || "primary",
      meet: true,
      apiUrl,
      tokenUrl,
    };

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (calendarId && clientEmail && privateKey)
    return {
      auth: { kind: "service" as const, clientEmail, privateKey },
      calendarId,
      meet: false,
      apiUrl,
      tokenUrl,
    };
  return null;
}

type GoogleConfig = NonNullable<ReturnType<typeof googleConfig>>;

export const googleSyncEnabled = () => googleConfig() !== null;
export const googleMeetEnabled = () => googleConfig()?.meet === true;

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const tokenCache = globalThis as unknown as { synegoGoogleToken?: { value: string; expires: number } };
const GOOGLE_TIMEOUT_MS = 10_000;

// Demande de jeton : rafraîchissement OAuth, ou assertion JWT signée par le compte de service.
function tokenRequest(config: GoogleConfig) {
  if (config.auth.kind === "oauth")
    return new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret,
      refresh_token: config.auth.refreshToken,
    });
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.auth.clientEmail,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: config.tokenUrl,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.auth.privateKey);
  return new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claims}.${base64url(signature)}`,
  });
}

async function accessToken(config: GoogleConfig) {
  const cached = tokenCache.synegoGoogleToken;
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenRequest(config),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  // 400 « invalid_grant » en OAuth : jeton de rafraîchissement révoqué ou expiré (voir le README).
  if (!response.ok) throw new Error(`jeton Google refusé (${response.status}) ${await response.text()}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.synegoGoogleToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Identifiant d'événement Google déduit de l'identifiant du rendez-vous (caractères a-v et 0-9) :
// pas besoin de le stocker, et une nouvelle tentative ne crée pas de doublon.
const googleEventId = (id: number) => `rdv${String(id).padStart(6, "0")}`;

type GoogleEvent = {
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

const meetLinkOf = (event: GoogleEvent) =>
  event.hangoutLink ?? event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ?? null;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Reporte l'état d'un rendez-vous dans Google Agenda : création, mise à jour ou suppression.
// Pour une visio (connexion OAuth), Google crée un lien Meet, enregistré avec le rendez-vous ;
// il reste le même si le rendez-vous est déplacé.
// Appelée après la réponse (`after`) : une panne de Google ne bloque jamais une réservation.
export async function syncAppointment(id: number, site: string) {
  const config = googleConfig();
  if (!config) return;
  try {
    const database = await db();
    const [row] = await database.select().from(appointments).where(eq(appointments.id, id));
    const token = await accessToken(config);
    const events = `${config.apiUrl}/calendars/${encodeURIComponent(config.calendarId)}/events`;
    const eventId = googleEventId(id);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const call = (url: string, init: RequestInit) =>
      fetch(url, { ...init, headers, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });

    // Rendez-vous annulé, ou supprimé par le gérant : l'événement est retiré.
    if (!row || row.status === "cancelled") {
      const removed = await call(`${events}/${eventId}`, { method: "DELETE" });
      // 404 / 410 : l'événement n'existait pas ou a déjà été supprimé.
      if (!removed.ok && removed.status !== 404 && removed.status !== 410)
        throw new Error(`suppression refusée (${removed.status})`);
      return;
    }

    const event = adminEvent(row, site);
    // Lien Meet demandé tant que le rendez-vous n'en a pas. Ensuite, la mise à jour se fait
    // sans `conferenceDataVersion` : Google conserve alors la visioconférence existante.
    const createMeet = config.meet && row.format === "visio" && !row.meetUrl;
    const query = createMeet ? "?conferenceDataVersion=1" : "";
    const body = JSON.stringify({
      id: eventId,
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: row.starts.toISOString(), timeZone: "Europe/Paris" },
      end: { dateTime: row.ends.toISOString(), timeZone: "Europe/Paris" },
      // Le client n'est pas invité : Google ne lui envoie aucun e-mail.
      reminders: { useDefault: true },
      ...(createMeet
        ? {
            conferenceData: {
              createRequest: { requestId: `synego-${eventId}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
            },
          }
        : {}),
    });
    let saved = await call(`${events}/${eventId}${query}`, { method: "PUT", body });
    if (saved.status === 404) saved = await call(`${events}${query}`, { method: "POST", body });
    if (!saved.ok) throw new Error(`enregistrement refusé (${saved.status}) ${await saved.text()}`);
    if (!createMeet) return;

    // La création de la visioconférence peut être différée (« pending ») : on relit l'événement.
    let result = (await saved.json()) as GoogleEvent;
    for (let attempt = 0; attempt < 3 && !meetLinkOf(result); attempt++) {
      if (result.conferenceData?.createRequest?.status?.statusCode !== "pending") break;
      await pause(1500);
      const reread = await call(`${events}/${eventId}`, { method: "GET" });
      if (!reread.ok) break;
      result = (await reread.json()) as GoogleEvent;
    }
    const meetUrl = meetLinkOf(result);
    if (!meetUrl) {
      console.warn(`[agenda] aucun lien Google Meet pour le rendez-vous ${id}.`);
      return;
    }
    await database.update(appointments).set({ meetUrl }).where(eq(appointments.id, id));
  } catch (error) {
    console.error(`[agenda] synchronisation Google du rendez-vous ${id} impossible :`, error);
  }
}
