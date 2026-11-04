import { TIME_ZONE } from "@/lib/format"

// Dates du calendrier du gérant, toujours à l'heure de Paris, quel que soit le fuseau du navigateur.
// Un jour est représenté par sa clé « AAAA-MM-JJ » ; les calculs de jours se font en UTC sur ces
// clés (pas d'heure d'été à gérer pour additionner des jours).

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

// Jour (clé) et minutes depuis minuit, à Paris.
export function parisTime(timestamp: number) {
  const values = Object.fromEntries(parts.formatToParts(timestamp).map((part) => [part.type, part.value]))
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  }
}

const toUtc = (day: string) => {
  const [year, month, date] = day.split("-").map(Number)
  return Date.UTC(year, month - 1, date)
}
const fromUtc = (value: number) => new Date(value).toISOString().slice(0, 10)

export const today = () => parisTime(Date.now()).day

export const addDays = (day: string, count: number) => fromUtc(toUtc(day) + count * 86_400_000)

// Lundi de la semaine du jour donné.
export function weekStart(day: string) {
  const weekday = (new Date(toUtc(day)).getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

export const weekDays = (day: string) => Array.from({ length: 7 }, (_, index) => addDays(weekStart(day), index))

// Six semaines complètes couvrant le mois du jour donné, du lundi au dimanche.
export function monthDays(day: string) {
  const first = `${day.slice(0, 8)}01`
  const start = weekStart(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7)

// Libellé d'un jour (« lundi 9 novembre »), formaté sur la date UTC de la clé : aucun décalage.
export function dayLabel(day: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Date(toUtc(day)).toLocaleDateString(locale, { ...options, timeZone: "UTC" })
}
