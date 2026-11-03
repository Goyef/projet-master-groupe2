// Événements d'agenda : fichier iCalendar (.ics, RFC 5545) et lien « Ajouter à Google Agenda ».
// Utilisé côté navigateur (boutons du client) et côté serveur (flux d'abonnement du gérant).

import { TIME_ZONE } from "@/lib/format"

export type CalendarEvent = {
  // Identifiant stable : un agenda reconnaît ainsi le même rendez-vous d'un import à l'autre.
  uid: string
  title: string
  description: string
  location?: string
  starts: number
  ends: number
}

// 20261109T130000Z : date UTC au format iCalendar et Google Agenda.
export function calendarDate(value: number) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

// Échappement des valeurs texte iCalendar (antislash, point-virgule, virgule, retours à la ligne).
function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

// Les lignes de plus de 75 octets sont repliées (suite précédée d'une espace), sans couper un caractère.
function fold(line: string) {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ""
  for (const char of line) {
    const limit = parts.length ? 74 : 75
    if (encoder.encode(current + char).length > limit) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join("\r\n ")
}

export function toIcs(events: CalendarEvent[], calendarName: string) {
  const stamp = calendarDate(Date.now())
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Synego//Rendez-vous//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${calendarDate(event.starts)}`,
      `DTEND:${calendarDate(event.ends)}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

// Lien qui ouvre Google Agenda avec l'événement prérempli (le client confirme l'ajout).
export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${calendarDate(event.starts)}/${calendarDate(event.ends)}`,
    details: event.description,
    ctz: TIME_ZONE,
  })
  if (event.location) params.set("location", event.location)
  return `https://calendar.google.com/calendar/render?${params}`
}

// Identifiant iCalendar d'un rendez-vous du site.
export const appointmentUid = (id: number) => `rendez-vous-${id}@synego`
