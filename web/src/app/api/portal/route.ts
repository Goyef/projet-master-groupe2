import { after, NextRequest, NextResponse } from "next/server";

import { siteConfig } from "@/config/site";
import type { Texts } from "@/content/texts";
import { getDictionary } from "@/content/dictionaries";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/lib/i18n";
import { feedPath, googleMeetEnabled, googleSyncEnabled, siteUrl, syncAppointment } from "@/lib/agenda";
import {
  mailAccountCreated,
  mailBookingCancelled,
  mailBookingConfirmed,
  mailBookingRescheduled,
  mailCancelledByOwner,
  mailRescheduledByOwner,
  mailSessionReport,
  mailPasswordReset,
  mailTicketCreated,
  mailTicketReply,
  mailWelcome,
  mailWaitlistJoined,
} from "@/lib/mail/notifications";
import { notifyWaitlist, subscribeWaitlist, unsubscribeWaitlist, waitlistCounts } from "@/lib/waitlist";
import {
  addDocument,
  addSlotRange,
  AppError,
  availableSlots,
  cancelAppointment,
  changePassword,
  completedSessions,
  createClient,
  createTicket,
  currentUser,
  deleteAppointment,
  deleteMood,
  listMoodEntries,
  MOOD_NOTE_MAX,
  saveMood,
  getDocument,
  listAppointments,
  listClients,
  listDocuments,
  listSessionNotes,
  listTickets,
  listUpcomingSlots,
  login,
  logout,
  MAX_REQUIRED_SESSIONS,
  ownerCancelAppointment,
  ownerRescheduleAppointment,
  PREPARATION_MAX,
  removeDocument,
  removeSlot,
  registerClient,
  replyTicket,
  requestPasswordReset,
  resetPassword,
  rescheduleAppointment,
  resetClientPassword,
  reserve,
  savePreparation,
  saveSessionReport,
  SESSION_ACTION_MAX,
  SESSION_ACTIONS_MAX,
  setSessionActionDone,
  setTicketStatus,
  SLOT_LENGTHS,
  SUMMARY_MAX,
  type SlotLength,
  TICKET_STATUSES,
  type TicketStatus,
  toggleClient,
  toggleCompleted,
  types,
  updateProfile,
  type AppointmentType,
  type MeetingFormat,
} from "@/lib/store";

type ErrorCode = keyof Texts["errors"];

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
// Champ du formulaire concerné par chaque erreur : le message s'affiche sous ce champ.
const errorFields: Partial<Record<ErrorCode, string>> = {
  invalidEmail: "email",
  invalidPhone: "phone",
  consentRequired: "consent",
  passwordTooShort: "password",
  emailTaken: "email",
  badCredentials: "password",
  formatUnavailable: "format",
  slotTaken: "slot",
  recipientsRequired: "recipients",
  slotTooSoon: "slot",
  wrongPassword: "currentPassword",
  slotPast: "starts",
  slotInvalid: "ends",
  slotOverlap: "starts",
  pdfInvalid: "file",
  sessionsInvalid: "required_sessions",
  sessionActionsInvalid: "actions",
  waitlistConsent: "consent",
  moodInvalid: "mood",
  moodNoteTooLong: "note",
};

// Langue de l'interface utilisée pour la requête (messages d'erreur et e-mails du visiteur).
function requestLocale(request: NextRequest): Locale {
  const preference = request.cookies.get(LOCALE_COOKIE)?.value;
  const language = request.headers.get("accept-language");
  return language ? negotiateLocale(language) : isLocale(preference) ? preference : "fr";
}

function failureFor(request: NextRequest) {
  const locale = requestLocale(request);
  const { errors } = getDictionary(locale);
  // Les codes restent stables pour les clients API ; seul le message est traduit.
  return (code: ErrorCode, status = 400, detail?: string) => {
    if (process.env.NODE_ENV !== "production")
      console.warn(`[api/portal] ${status} ${code}${detail ? ` (${detail})` : ""}`);
    const field = code === "invalidField" ? detail : errorFields[code];
    const result = response({ error: errors[code], code, field }, status);
    result.headers.set("Content-Language", locale);
    return result;
  };
}
function text(data: Record<string, unknown>, key: string, max = 160) {
  const value = data[key];
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new AppError("invalidField", 400, key);
  return value.trim();
}
function email(data: Record<string, unknown>) {
  const value = text(data, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new AppError("invalidEmail");
  return value;
}
function phone(data: Record<string, unknown>) {
  const value = text(data, "phone", 30);
  // Formats internationaux usuels : chiffres, espaces, points, tirets, parenthèses, « + » initial.
  if (!/^\+?[\d\s().-]{6,}$/.test(value) || value.replace(/\D/g, "").length < 6)
    throw new AppError("invalidPhone");
  return value;
}
function id(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw new AppError("invalidField");
  return number;
}
function appointmentType(value: unknown): AppointmentType {
  if (typeof value !== "string" || !Object.hasOwn(types, value))
    throw new AppError("invalidField");
  return value as AppointmentType;
}
function meetingFormat(value: unknown): MeetingFormat {
  const formats: readonly string[] = siteConfig.meetingFormats;
  if (typeof value !== "string" || !formats.includes(value))
    throw new AppError("formatUnavailable");
  return value as MeetingFormat;
}

// Préparation de séance : vide = effacée.
function preparation(data: Record<string, unknown>) {
  const value = data.preparation;
  if (typeof value !== "string" || value.length > PREPARATION_MAX)
    throw new AppError("invalidField", 400, "preparation");
  return value.trim() || null;
}
// Actions du compte rendu : `{ id?, label }`, 5 au plus ; `id` désigne une action existante.
function sessionActionsInput(value: unknown) {
  if (!Array.isArray(value) || value.length > SESSION_ACTIONS_MAX)
    throw new AppError("sessionActionsInvalid");
  const seen = new Set<number>();
  return value.map((item: unknown) => {
    const { id: actionId, label } = (item ?? {}) as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim() || label.length > SESSION_ACTION_MAX)
      throw new AppError("sessionActionsInvalid");
    if (actionId === undefined || actionId === null) return { label: label.trim() };
    const known = id(actionId);
    if (seen.has(known)) throw new AppError("sessionActionsInvalid");
    seen.add(known);
    return { id: known, label: label.trim() };
  });
}

function ticketStatus(value: unknown): TicketStatus {
  const statuses: readonly string[] = TICKET_STATUSES;
  if (typeof value !== "string" || !statuses.includes(value))
    throw new AppError("invalidField", 400, "status");
  return value as TicketStatus;
}

// Journal d'humeur : niveau 1 (orage) à 5 (soleil) et note facultative.
function moodLevel(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 5)
    throw new AppError("moodInvalid", 400, `mood=${value}`);
  return value as number;
}
function moodNote(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new AppError("moodNoteTooLong");
  if (value.length > MOOD_NOTE_MAX) throw new AppError("moodNoteTooLong");
  return value.trim() || null;
}

export async function GET(request: NextRequest) {
  const failure = failureFor(request);
  const params = request.nextUrl.searchParams;
  try {
    const user = await currentUser(request.cookies.get("session")?.value);
    const action = params.get("action");
    if (action === "slots") {
      const type = appointmentType(params.get("type"));
      // Séances de suivi : visibles par les clients, et par le gérant (pour déplacer un rendez-vous).
      if (type === "suivi" && user?.role !== "client" && user?.role !== "admin")
        return failure("clientRequired", 401);
      return response({ slots: await availableSlots(type) });
    }
    if (action === "document") {
      if (!user) return failure("loginRequired", 401);
      const document = await getDocument(user, id(params.get("id")));
      if (!document) return failure("documentNotFound", 404);
      return new NextResponse(new Uint8Array(document.content), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="document.pdf"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (!user) return response({ user: null });
    const admin = user.role === "admin";
    const [appointments, documents, tickets, clients, slots, sessions, sessionNotes, mood] = await Promise.all([
      listAppointments(user),
      listDocuments(user),
      listTickets(user),
      admin ? listClients() : undefined,
      admin ? listUpcomingSlots() : undefined,
      admin ? undefined : completedSessions(user.id),
      listSessionNotes(user),
      // Client : son journal des 30 derniers jours ; gérant : celui de tous les clients sur 14 jours.
      listMoodEntries(user),
    ]);
    return response({
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        passwordTemporary: user.passwordTemporary,
      },
      appointments,
      documents,
      tickets,
      sessionNotes,
      mood,
      ...(admin
        ? {
            clients,
            slots,
            agenda: { feedPath: feedPath(), googleSync: googleSyncEnabled(), googleMeet: googleMeetEnabled() },
            waitlist: await waitlistCounts(),
          }
        : { completedSessions: sessions }),
    });
  } catch (error) {
    return handle(error, failure);
  }
}

export async function POST(request: NextRequest) {
  const failure = failureFor(request);
  const origin = request.headers.get("origin");
  // Next peut normaliser nextUrl sur localhost : comparer à l’hôte reçu.
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || "");
    sameOrigin =
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.host === request.headers.get("host");
  } catch {}
  if (!sameOrigin) return failure("originRefused", 403);
  if (Number(request.headers.get("content-length") || 0) > 8_000_000)
    return failure("tooLarge", 413);
  try {
    const user = await currentUser(request.cookies.get("session")?.value);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (user?.role !== "admin") return failure("adminRequired", 403);
      const form = await request.formData();
      const file = form.get("file");
      const title = String(form.get("title") || "").trim();
      if (
        !(file instanceof File) ||
        file.size > 5_000_000 ||
        !title ||
        title.length > 160
      )
        throw new AppError("pdfInvalid");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw new AppError("pdfInvalid");
      // Destinataires : tous les clients, ou une liste de clients (champ `user_ids` répété).
      const recipients =
        form.get("all_clients") === "true" ? ("all" as const) : form.getAll("user_ids").map(id);
      // Séances réalisées nécessaires avant que le client puisse ouvrir le document.
      const requiredSessions = Number(form.get("required_sessions") || 0);
      if (
        !Number.isSafeInteger(requiredSessions) ||
        requiredSessions < 0 ||
        requiredSessions > MAX_REQUIRED_SESSIONS
      )
        throw new AppError("sessionsInvalid", 400, `required_sessions=${form.get("required_sessions")}`);
      await addDocument(title, bytes, recipients, requiredSessions);
      return response({ ok: true });
    }
    const data = (await request.json()) as Record<string, unknown>;
    if (data.action === "login")
      return withSession(
        await login(email(data), text(data, "password", 256)),
      );
    // Inscription libre : le visiteur crée lui-même son compte client et est connecté.
    if (data.action === "register") {
      if (data.consent !== true) throw new AppError("consentRequired");
      const password = text(data, "password", 256);
      if (password.length < 12) throw new AppError("passwordTooShort");
      const account = { name: text(data, "name"), email: email(data) };
      const session = await registerClient(account.name, account.email, phone(data), password);
      mailLater(request, (locale, site) => mailWelcome(account, locale, site));
      return withSession(session);
    }
    // Mot de passe oublié : même réponse que l'adresse ait un compte ou non.
    if (data.action === "forgot-password") {
      const reset = await requestPasswordReset(email(data));
      if (reset) mailLater(request, (locale, site) => mailPasswordReset(reset.account, reset.token, locale, site));
      return response({ ok: true });
    }
    if (data.action === "reset-password") {
      const password = text(data, "password", 256);
      if (password.length < 12) throw new AppError("passwordTooShort");
      return withSession(await resetPassword(text(data, "token", 200), password));
    }
    // Liste d'attente : réponse identique qu'une inscription existe déjà ou non (réinscription =
    // mise à jour) et que la limite de débit soit atteinte ou non.
    if (data.action === "waitlist-subscribe") {
      if (data.consent !== true) throw new AppError("waitlistConsent");
      const type = appointmentType(data.type);
      if (type === "suivi" && user?.role !== "client") return failure("clientRequired", 401);
      const entry = await subscribeWaitlist(email(data), type, requestLocale(request));
      if (entry) mailLater(request, (_locale, site) => mailWaitlistJoined(entry, entry.token, site));
      return response({ ok: true });
    }
    if (data.action === "waitlist-unsubscribe") {
      await unsubscribeWaitlist(text(data, "token", 200));
      return response({ ok: true });
    }
    if (data.action === "logout") {
      const token = request.cookies.get("session")?.value;
      if (token) await logout(token);
      const result = response({ ok: true });
      result.cookies.delete("session");
      return result;
    }
    if (data.action === "reserve") {
      if (data.consent !== true) throw new AppError("consentRequired");
      const { appointment, repeated } = await reserve({
        type: appointmentType(data.type),
        slotId: id(data.slot),
        format: meetingFormat(data.format),
        // Un client connecté réserve avec les informations de son compte.
        firstName: user ? user.name : text(data, "firstName", 80),
        lastName: user ? "" : text(data, "lastName", 80),
        email: user ? user.email : email(data),
        phone: phone(data),
        intention: text(data, "intention", 1000),
        user,
        locale: requestLocale(request),
      });
      // Une demande reçue deux fois ne déclenche ni deuxième synchronisation ni deuxième e-mail.
      if (!repeated) {
        syncLater(request, appointment.id, (locale, site) => mailBookingConfirmed(appointment.id, locale, site));
      }
      return response({
        ok: true,
        reference: appointment.id,
        starts: appointment.starts.getTime(),
      });
    }
    if (data.action === "create-ticket") {
      if (user?.role !== "client") return failure("loginRequired", 401);
      const ticket = await createTicket(
        user,
        text(data, "subject"),
        text(data, "message", 4000),
      );
      mailLater(request, (_locale, site) => mailTicketCreated(ticket.id, site));
      return response({ ok: true, reference: ticket.id });
    }
    // Préparation de séance et actions du compte rendu : par le client, sur ses propres rendez-vous.
    if (data.action === "save-preparation" || data.action === "session-action") {
      if (user?.role !== "client") return failure("clientRequired", 401);
      if (data.action === "save-preparation") {
        await savePreparation(user, id(data.id), preparation(data));
      } else {
        if (typeof data.done !== "boolean") throw new AppError("invalidField", 400, "done");
        await setSessionActionDone(user, id(data.id), data.done);
      }
      return response({ ok: true });
    }
    // Journal d'humeur : le client ne modifie que ses propres entrées ; le gérant le consulte seulement.
    if (data.action === "save-mood" || data.action === "delete-mood") {
      if (!user) return failure("loginRequired", 401);
      if (user.role !== "client") return failure("moodClientOnly", 403);
      const entryId = data.id === undefined || data.id === null ? undefined : id(data.id);
      if (data.action === "delete-mood") {
        if (entryId === undefined) throw new AppError("invalidField", 400, "id");
        await deleteMood(user, entryId);
        return response({ ok: true });
      }
      const saved = await saveMood(user, moodLevel(data.mood), moodNote(data.note), entryId);
      return response({ ok: true, day: saved.day });
    }
    // Gestion de ses rendez-vous et de son profil par le client connecté.
    if (
      typeof data.action === "string" &&
      ["cancel", "reschedule", "update-profile", "change-password"].includes(data.action)
    ) {
      if (user?.role !== "client") return failure("clientRequired", 401);
      if (data.action === "cancel") {
        const appointmentId = id(data.id);
        const cancelled = await cancelAppointment(user, appointmentId);
        syncLater(request, appointmentId, (locale, site) => mailBookingCancelled(appointmentId, locale, site));
        waitlistLater(request, cancelled.starts);
        return response({ ok: true });
      }
      if (data.action === "reschedule") {
        const appointmentId = id(data.id);
        const moved = await rescheduleAppointment(
          user,
          appointmentId,
          id(data.slot),
          requestLocale(request),
        );
        waitlistLater(request, moved.previousStarts);
        syncLater(request, appointmentId, (locale, site) =>
          mailBookingRescheduled(appointmentId, moved.previousStarts, locale, site),
        );
        return response({ ok: true, starts: moved.starts.getTime() });
      }
      if (data.action === "update-profile") {
        await updateProfile(user, text(data, "name"), phone(data));
        return response({ ok: true });
      }
      const password = text(data, "password", 256);
      if (password.length < 12) throw new AppError("passwordTooShort");
      await changePassword(
        user,
        request.cookies.get("session")?.value ?? "",
        text(data, "currentPassword", 256),
        password,
      );
      return response({ ok: true });
    }
    if (user?.role !== "admin") return failure("adminRequired", 403);
    // Les comptes clients sont créés par le gérant : le mot de passe provisoire
    // n'est renvoyé qu'ici, une seule fois, pour qu'il le transmette au client.
    if (data.action === "create-client") {
      const created = await createClient(text(data, "name"), email(data), phone(data));
      // Le client reçoit aussi un lien pour choisir lui-même son mot de passe.
      mailLater(request, (locale, site) => mailAccountCreated(created.id, locale, site));
      return response({ ok: true, password: created.password });
    }
    if (data.action === "reset-client-password") {
      return response({ ok: true, password: await resetClientPassword(id(data.id)) });
    }
    // Rendez-vous gérés par le gérant : annuler, déplacer, supprimer. `notify` (vrai par défaut)
    // prévient le client par e-mail ; Google Agenda est mis à jour dans tous les cas.
    if (data.action === "owner-cancel" || data.action === "owner-reschedule" || data.action === "owner-delete") {
      const appointmentId = id(data.id);
      const notify = data.notify !== false;
      if (data.action === "owner-reschedule") {
        const moved = await ownerRescheduleAppointment(appointmentId, id(data.slot));
        syncLater(
          request,
          appointmentId,
          notify ? (_locale, site) => mailRescheduledByOwner(appointmentId, moved.previousStarts, site) : undefined,
        );
        waitlistLater(request, moved.previousStarts);
        return response({ ok: true, starts: moved.starts.getTime() });
      }
      const row =
        data.action === "owner-cancel"
          ? await ownerCancelAppointment(appointmentId)
          : await deleteAppointment(appointmentId);
      syncLater(request, appointmentId);
      // Créneau libéré : rendez-vous annulé, ou supprimé alors qu'il occupait encore son créneau.
      if (data.action === "owner-cancel" || row.slotId !== null) waitlistLater(request, row.starts);
      // Seul un rendez-vous encore à venir et confirmé justifie de prévenir le client.
      const wasUpcoming =
        row.starts.getTime() > Date.now() && (data.action === "owner-cancel" || row.status === "confirmed");
      if (notify && wasUpcoming) mailLater(request, (_locale, site) => mailCancelledByOwner(row, site));
      return response({ ok: true });
    }
    if (data.action === "toggle-client") {
      await toggleClient(id(data.id));
    } else if (data.action === "add-slot") {
      const starts = Number(data.starts);
      const ends = Number(data.ends);
      const minutes = Number(data.minutes) as SlotLength;
      if (
        !Number.isSafeInteger(starts) ||
        !Number.isSafeInteger(ends) ||
        !SLOT_LENGTHS.includes(minutes) ||
        ends - starts < minutes * 60000 ||
        ends - starts > 14 * 3600000
      )
        throw new AppError(
          "slotInvalid",
          400,
          `starts=${data.starts} ends=${data.ends} minutes=${data.minutes}`,
        );
      if (starts <= Date.now()) throw new AppError("slotPast");
      const added = await addSlotRange(new Date(starts), new Date(ends), minutes);
      waitlistLater(request, new Date(starts), new Date(ends));
      return response({ ok: true, ...added });
    } else if (data.action === "remove-slot") {
      await removeSlot(id(data.id));
    } else if (data.action === "complete") {
      await toggleCompleted(id(data.id));
    } else if (data.action === "session-report") {
      // Compte rendu d'une séance réalisée : e-mail au client à la première publication seulement.
      const appointmentId = id(data.id);
      const saved = await saveSessionReport(
        appointmentId,
        text(data, "summary", SUMMARY_MAX),
        sessionActionsInput(data.actions),
      );
      if (saved.first) mailLater(request, (_locale, site) => mailSessionReport(appointmentId, site));
    } else if (data.action === "reply-ticket") {
      const ticketId = id(data.id);
      const message = text(data, "message", 4000);
      await replyTicket(ticketId, message);
      mailLater(request, (_locale, site) => mailTicketReply(ticketId, message, site));
    } else if (data.action === "ticket-status") {
      await setTicketStatus(id(data.id), ticketStatus(data.status));
    } else if (data.action === "remove-document") {
      await removeDocument(id(data.id));
    } else {
      throw new AppError("unknownAction");
    }
    return response({ ok: true });
  } catch (error) {
    return handle(error, failure);
  }
}

// Reporte le rendez-vous dans Google Agenda après la réponse, sans la retarder, puis envoie
// l'e-mail éventuel : il part après la synchronisation pour contenir le lien Google Meet.
function syncLater(
  request: NextRequest,
  appointmentId: number,
  send?: (locale: Locale, site: string) => Promise<unknown>,
) {
  const locale = requestLocale(request);
  const site = siteUrl(request.nextUrl.origin);
  after(async () => {
    await syncAppointment(appointmentId, site);
    await send?.(locale, site).catch((error) => console.error("[mail] préparation impossible :", error));
  });
}

// Liste d'attente : prévient les inscrits après la réponse si des créneaux de [from, to) sont
// de nouveau réservables (par défaut, le seul créneau qui commence à `from`).
function waitlistLater(request: NextRequest, from: Date, to = new Date(from.getTime() + 1)) {
  const site = siteUrl(request.nextUrl.origin);
  after(() =>
    notifyWaitlist(from, to, site).catch((error) => console.error("[liste d'attente] notification impossible :", error)),
  );
}

// Envoie un e-mail après la réponse : le visiteur n'attend pas l'API d'envoi.
function mailLater(request: NextRequest, send: (locale: Locale, site: string) => Promise<unknown>) {
  const locale = requestLocale(request);
  const site = siteUrl(request.nextUrl.origin);
  after(() =>
    send(locale, site).catch((error) => console.error("[mail] préparation impossible :", error)),
  );
}

function withSession(token: string) {
  const result = response({ ok: true });
  result.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 28800,
  });
  return result;
}

function handle(error: unknown, failure: ReturnType<typeof failureFor>) {
  if (error instanceof AppError)
    return failure(error.code as ErrorCode, error.status, error.detail);
  if (error instanceof SyntaxError) return failure("generic");
  console.error(error);
  return failure("generic", 500);
}
