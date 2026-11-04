import "server-only";
import { eq } from "drizzle-orm";

import { getDictionary } from "@/content/dictionaries";
import { appointments, tickets, users } from "@/db/schema";
import { appointmentUid, googleCalendarUrl } from "@/lib/calendar";
import { format, formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { createPasswordResetToken, db, types, WELCOME_LINK_MS } from "@/lib/store";

import { renderMail, type MailBlock } from "./render";
import { adminRecipient, sendMail } from "./send";

// E-mails de l'application : chaque fonction recharge ses données puis envoie le message.
// Elles sont appelées après la réponse (`after`) : une erreur est journalisée, jamais renvoyée
// au visiteur. « Ce qui vous amène » n'est jamais repris dans un e-mail.

type AppointmentRow = typeof appointments.$inferSelect;

// Le gérant lit ses notifications en français.
const ADMIN_LOCALE: Locale = "fr";

async function loadAppointment(id: number) {
  const database = await db();
  const [row] = await database.select().from(appointments).where(eq(appointments.id, id));
  return row ?? null;
}

function appointmentDetails(row: AppointmentRow, locale: Locale) {
  const dict = getDictionary(locale);
  return {
    type: dict.types[row.type],
    date: formatDateTime(row.starts, locale),
    rows: [
      [dict.emails.labelType, dict.types[row.type]],
      [dict.emails.labelDate, formatDateTime(row.starts, locale)],
      [dict.emails.labelDuration, format(dict.emails.minutes, { minutes: types[row.type].minutes })],
      [dict.emails.labelFormat, dict.formats[row.format]],
    ] as [string, string][],
  };
}

// Visio : bouton Google Meet (lien aussi en clair) ; sans lien, Youcef l'enverra lui-même.
function visioBlocks(row: AppointmentRow, locale: Locale, withoutLink: "note" | "none"): MailBlock[] {
  if (row.format !== "visio") return [];
  const dict = getDictionary(locale).emails;
  if (row.meetUrl)
    return [
      { kind: "button", label: dict.joinMeet, url: row.meetUrl, fallback: true },
      { kind: "note", text: dict.meetNote },
    ];
  return withoutLink === "note" ? [{ kind: "note", text: dict.visioNote }] : [];
}

// « Séance de suivi » → « séance de suivi », au milieu d'une phrase.
const inSentence = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

function personName(row: AppointmentRow) {
  return `${row.firstName} ${row.lastName}`.trim();
}

// Lien Google Agenda prérempli, comme le bouton « Ajouter à mon agenda » du site.
function calendarLink(row: AppointmentRow, locale: Locale, site: string) {
  const dict = getDictionary(locale);
  const values = {
    type: dict.types[row.type],
    format: dict.formats[row.format].toLowerCase(),
    minutes: types[row.type].minutes,
    url: `${site}/connexion`,
    visio: row.meetUrl ? format(dict.calendar.meetLine, { meet: row.meetUrl }) : dict.calendar.meetPending,
  };
  return googleCalendarUrl({
    uid: appointmentUid(row.id),
    title: format(dict.calendar.clientTitle, values),
    description: format(dict.calendar.clientDescription, values),
    location: row.meetUrl ?? dict.formats[row.format],
    starts: row.starts.getTime(),
    ends: row.ends.getTime(),
  });
}

async function send(to: string, locale: Locale, site: string, subject: string, title: string, blocks: MailBlock[], name?: string) {
  const dict = getDictionary(locale).emails;
  const { html, text } = renderMail({ dict, locale, site, title, name, blocks });
  return sendMail({ to, subject, html, text });
}

// Notification du gérant : sans signature. Pas de Reply-To vers le client (autre domaine que
// l'expéditeur, motif d'hameçonnage) : son adresse figure dans le corps du message.
async function sendToAdmin(subject: string, title: string, blocks: MailBlock[], site: string) {
  const to = adminRecipient();
  if (!to) return;
  const dict = getDictionary(ADMIN_LOCALE).emails;
  const { html, text } = renderMail({ dict, locale: ADMIN_LOCALE, site, title, blocks, internal: true });
  return sendMail({ to, subject, html, text });
}

// Notification du gérant : qui, quand, comment le joindre.
async function notifyAdmin(
  row: AppointmentRow,
  site: string,
  copy: { subject: string; title: string; intro: string },
  values: Record<string, string> = {},
) {
  const dict = getDictionary(ADMIN_LOCALE).emails;
  const details = appointmentDetails(row, ADMIN_LOCALE);
  const name = personName(row);
  await sendToAdmin(
    format(copy.subject, { type: details.type, name, date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, values) },
      {
        kind: "details",
        rows: [
          ...details.rows,
          [dict.labelName, name],
          [dict.labelEmail, row.email],
          [dict.labelPhone, row.phone],
          [dict.labelProfile, row.userId ? dict.profileClient : dict.profileProspect],
        ],
      },
      { kind: "button", label: dict.openAdminArea, url: `${site}/connexion` },
    ],
    site,
  );
}

export async function mailBookingConfirmed(appointmentId: number, locale: Locale, site: string) {
  const row = await loadAppointment(appointmentId);
  if (!row) return;
  const dict = getDictionary(locale).emails;
  const details = appointmentDetails(row, locale);
  const copy = dict.bookingConfirmed;
  await send(
    row.email,
    locale,
    site,
    format(copy.subject, { date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { type: inSentence(details.type) }) },
      { kind: "details", rows: details.rows },
      ...visioBlocks(row, locale, "note"),
      { kind: "button", label: dict.addToCalendar, url: calendarLink(row, locale, site) },
      row.userId
        ? { kind: "paragraph", text: copy.manageClient }
        : { kind: "paragraph", text: copy.manageProspect },
      ...(row.userId ? [{ kind: "button", label: dict.openClientArea, url: `${site}/connexion` } as const] : []),
    ],
    row.userId ? row.firstName : personName(row),
  );
  await notifyAdmin(row, site, getDictionary(ADMIN_LOCALE).emails.adminBooked);
}

export async function mailBookingRescheduled(
  appointmentId: number,
  previousStarts: Date,
  locale: Locale,
  site: string,
) {
  const row = await loadAppointment(appointmentId);
  if (!row) return;
  const dict = getDictionary(locale).emails;
  const details = appointmentDetails(row, locale);
  const copy = dict.bookingRescheduled;
  await send(
    row.email,
    locale,
    site,
    format(copy.subject, { date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { type: inSentence(details.type) }) },
      { kind: "details", rows: details.rows },
      { kind: "note", text: format(copy.previous, { date: formatDateTime(previousStarts, locale) }) },
      ...visioBlocks(row, locale, "none"),
      { kind: "button", label: dict.addToCalendar, url: calendarLink(row, locale, site) },
      { kind: "button", label: dict.openClientArea, url: `${site}/connexion` },
    ],
    row.firstName,
  );
  await notifyAdmin(row, site, getDictionary(ADMIN_LOCALE).emails.adminRescheduled, {
    date: formatDateTime(previousStarts, ADMIN_LOCALE),
  });
}

export async function mailBookingCancelled(appointmentId: number, locale: Locale, site: string) {
  const row = await loadAppointment(appointmentId);
  if (!row) return;
  const dict = getDictionary(locale).emails;
  const details = appointmentDetails(row, locale);
  const copy = dict.bookingCancelled;
  await send(
    row.email,
    locale,
    site,
    format(copy.subject, { date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { type: inSentence(details.type), date: details.date }) },
      { kind: "paragraph", text: copy.rebook },
      { kind: "button", label: dict.openClientArea, url: `${site}/connexion` },
    ],
    row.firstName,
  );
  await notifyAdmin(row, site, getDictionary(ADMIN_LOCALE).emails.adminCancelled);
}

// Lien « mot de passe oublié » (valable 1 heure, à usage unique).
export async function mailPasswordReset(
  account: { name: string; email: string },
  token: string,
  locale: Locale,
  site: string,
) {
  const dict = getDictionary(locale).emails;
  const copy = dict.passwordReset;
  await send(
    account.email,
    locale,
    site,
    copy.subject,
    copy.title,
    [
      { kind: "paragraph", text: copy.intro },
      { kind: "button", label: copy.button, url: resetUrl(site, token), fallback: true },
      { kind: "note", text: copy.ignore },
    ],
    account.name,
  );
}

export const resetUrl = (site: string, token: string) =>
  `${site}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;

// Bienvenue après une inscription libre.
export async function mailWelcome(account: { name: string; email: string }, locale: Locale, site: string) {
  const dict = getDictionary(locale).emails;
  const copy = dict.welcome;
  await send(
    account.email,
    locale,
    site,
    copy.subject,
    copy.title,
    [
      { kind: "paragraph", text: copy.intro },
      { kind: "button", label: dict.openClientArea, url: `${site}/connexion` },
    ],
    account.name,
  );
}

// Compte créé par le gérant : lien pour choisir son mot de passe (valable 7 jours).
export async function mailAccountCreated(userId: number, locale: Locale, site: string) {
  const database = await db();
  const [account] = await database
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  if (!account) return;
  const token = await createPasswordResetToken(userId, WELCOME_LINK_MS);
  const copy = getDictionary(locale).emails.accountCreated;
  await send(
    account.email,
    locale,
    site,
    copy.subject,
    copy.title,
    [
      { kind: "paragraph", text: copy.intro },
      { kind: "button", label: copy.button, url: resetUrl(site, token), fallback: true },
      { kind: "note", text: copy.expired },
    ],
    account.name,
  );
}

async function loadTicket(id: number) {
  const database = await db();
  const [row] = await database
    .select({ subject: tickets.subject, message: tickets.message, name: users.name, email: users.email })
    .from(tickets)
    .innerJoin(users, eq(users.id, tickets.userId))
    .where(eq(tickets.id, id));
  return row ?? null;
}

// Nouvelle demande de support : notification du gérant.
export async function mailTicketCreated(ticketId: number, site: string) {
  const ticket = await loadTicket(ticketId);
  if (!ticket) return;
  const dict = getDictionary(ADMIN_LOCALE).emails;
  const copy = dict.adminTicket;
  await sendToAdmin(
    format(copy.subject, { subject: ticket.subject }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { name: ticket.name, email: ticket.email }) },
      { kind: "quote", text: `${ticket.subject}\n\n${ticket.message}` },
      { kind: "button", label: dict.openAdminArea, url: `${site}/connexion` },
    ],
    site,
  );
}

// Réponse du gérant à une demande : notification du client (en français : la langue du client
// n'est pas connue quand c'est le gérant qui agit).
export async function mailTicketReply(ticketId: number, message: string, site: string) {
  const ticket = await loadTicket(ticketId);
  if (!ticket) return;
  const locale: Locale = "fr";
  const copy = getDictionary(locale).emails.ticketReply;
  await send(
    ticket.email,
    locale,
    site,
    format(copy.subject, { subject: ticket.subject }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { subject: ticket.subject }) },
      { kind: "quote", text: message },
      { kind: "button", label: copy.button, url: `${site}/connexion` },
    ],
    ticket.name,
  );
}

// Rendez-vous annulé (ou supprimé) par le gérant : le client est prévenu. Reçoit le rendez-vous
// tel qu'il était, car une suppression ne laisse plus rien en base. Le français est utilisé :
// la langue du client n'est pas connue quand c'est le gérant qui agit.
export async function mailCancelledByOwner(row: AppointmentRow, site: string) {
  const locale: Locale = "fr";
  const dict = getDictionary(locale).emails;
  const details = appointmentDetails(row, locale);
  const copy = dict.ownerCancelled;
  await send(
    row.email,
    locale,
    site,
    format(copy.subject, { date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { type: inSentence(details.type), date: details.date }) },
      { kind: "details", rows: details.rows },
      { kind: "paragraph", text: row.userId ? copy.rebookClient : copy.rebookProspect },
      { kind: "button", label: copy.book, url: `${site}${row.userId ? "/connexion" : "/rendez-vous"}` },
    ],
    row.userId ? row.firstName : personName(row),
  );
}

// Rendez-vous déplacé par le gérant : nouveau créneau, ancien créneau, lien Google Agenda.
export async function mailRescheduledByOwner(appointmentId: number, previousStarts: Date, site: string) {
  const row = await loadAppointment(appointmentId);
  if (!row) return;
  const locale: Locale = "fr";
  const dict = getDictionary(locale).emails;
  const details = appointmentDetails(row, locale);
  const copy = dict.ownerRescheduled;
  await send(
    row.email,
    locale,
    site,
    format(copy.subject, { date: details.date }),
    copy.title,
    [
      { kind: "paragraph", text: format(copy.intro, { type: inSentence(details.type) }) },
      { kind: "details", rows: details.rows },
      { kind: "note", text: format(copy.previous, { date: formatDateTime(previousStarts, locale) }) },
      ...visioBlocks(row, locale, "none"),
      { kind: "button", label: dict.addToCalendar, url: calendarLink(row, locale, site) },
      { kind: "paragraph", text: copy.contact },
    ],
    row.userId ? row.firstName : personName(row),
  );
}
