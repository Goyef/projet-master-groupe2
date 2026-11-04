import "server-only";

import type { Texts } from "@/content/texts";
import { INTENTION_MAX_LENGTH } from "@/lib/booking-prefill";
import { TIME_ZONE } from "@/lib/format";
import { intlLocales, type Locale } from "@/lib/i18n";
import { availableSlots, types, type User } from "@/lib/store";
import type { AssistantEvent } from "./protocol";
import { clip } from "./request";
import { TOOL_BOOKING, TOOL_CRISIS, TOOL_SLOTS } from "./tool-definitions";

// Exécution des outils appelés par le modèle. Chaque résultat est un objet JSON court, renvoyé
// au modèle ; les éléments d'interface (carte de réservation, numéros d'urgence) partent au
// navigateur par `emit`. Aucune donnée personnelle n'est lue ni renvoyée au modèle.

export type ToolContext = {
  user: User | null;
  locale: Locale;
  dict: Texts;
  emit: (event: AssistantEvent) => void;
};

// Jours et horaires renvoyés au plus : assez pour choisir, sans allonger inutilement la requête.
const SLOT_DAYS_MAX = 10;
const SLOTS_MAX = 40;

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

export async function runTool(name: string, rawArguments: unknown, context: ToolContext): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(typeof rawArguments === "string" && rawArguments ? rawArguments : "{}");
    if (parsed && typeof parsed === "object") args = parsed;
  } catch {
    return { error: "invalid_arguments" };
  }
  if (name === TOOL_SLOTS) return slots(args, context);
  if (name === TOOL_BOOKING) return booking(args, context);
  if (name === TOOL_CRISIS) {
    context.emit({ type: "action", action: { kind: "crisis" } });
    return { displayed: true, numbers: { suicide_prevention: "3114", samu: "15", european_emergency: "112" } };
  }
  return { error: "unknown_tool" };
}

async function slots(args: Record<string, unknown>, { user, locale, dict, emit }: ToolContext) {
  const type = args.appointment_type;
  if (type !== "vente" && type !== "audit" && type !== "suivi") return { error: "invalid_appointment_type" };
  // Même règle que l'API de réservation : le suivi est réservé aux clients connectés (et au gérant).
  if (type === "suivi" && user?.role !== "client" && user?.role !== "admin")
    return {
      error: "client_account_required",
      explanation: `Les séances de suivi se réservent depuis l'espace client, une fois connecté (/connexion, onglet « ${dict.portal.client.tabBook} »).`,
    };
  const from = typeof args.from_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.from_date) ? args.from_date : null;
  emit({ type: "status", status: "slots" });

  const dayLabel = new Intl.DateTimeFormat(intlLocales[locale], {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat(intlLocales[locale], { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

  const free = (await availableSlots(type)).filter((slot) => !from || dayKey.format(slot.starts) >= from);
  const grouped = new Map<string, { date: string; label: string; times: string[] }>();
  let listed = 0;
  for (const slot of free) {
    const date = dayKey.format(slot.starts);
    let day = grouped.get(date);
    if (!day) {
      if (grouped.size >= SLOT_DAYS_MAX) break;
      day = { date, label: dayLabel.format(slot.starts), times: [] };
      grouped.set(date, day);
    }
    if (listed >= SLOTS_MAX) break;
    day.times.push(time.format(slot.starts));
    listed += 1;
  }
  const bookingPage = type === "suivi" ? "/connexion" : "/rendez-vous";
  return {
    appointment_type: type,
    label: dict.types[type],
    duration_minutes: types[type].minutes,
    time_zone: "Europe/Paris (heure de Paris)",
    from_date: from,
    total_available: free.length,
    days: [...grouped.values()],
    listed_slots: listed,
    booking_page: bookingPage,
    note: free.length
      ? "Liste indicative : un créneau peut être réservé entre-temps. La réservation se fait sur la page indiquée."
      : `Aucun créneau libre pour l'instant${from ? " à partir de cette date" : ""}. Proposer la liste d'attente « ${dict.waitlist.title} » sur la page de réservation (une alerte par e-mail dès qu'un créneau se libère).`,
  };
}

function booking(args: Record<string, unknown>, { emit }: ToolContext) {
  const type = args.appointment_type;
  if (type !== "vente" && type !== "audit") return { error: "invalid_appointment_type" };
  const intention = typeof args.intention === "string" ? clip(args.intention.trim(), INTENTION_MAX_LENGTH) : "";
  emit({ type: "action", action: { kind: "booking", appointmentType: type, intention } });
  return {
    displayed: true,
    booking_page: "/rendez-vous",
    summary_included: Boolean(intention),
    note: "La carte est affichée sous ta réponse : l'utilisateur choisit son créneau et relit le résumé avant d'envoyer. Rien n'est encore réservé.",
  };
}
