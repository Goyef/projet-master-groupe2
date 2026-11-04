// Préremplissage du formulaire de réservation depuis une autre page (questionnaire, séminaires…).
// Contrat partagé : clé sessionStorage `synego:booking-prefill`, valeur JSON
// `{ "type"?: "vente" | "audit", "intention": string }`. Jamais dans l'URL : le texte peut être sensible.
export const BOOKING_PREFILL_KEY = "synego:booking-prefill"

// Longueur maximale du champ « Ce qui vous amène », vérifiée par l'API (action `reserve`).
export const INTENTION_MAX_LENGTH = 1000

export type BookingPrefill = { type?: "vente" | "audit"; intention: string }

// Valide la valeur stockée ; le texte est tronqué à la longueur acceptée par le serveur.
export function parseBookingPrefill(raw: string | null): BookingPrefill | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== "object") return null
  const { type, intention } = value as Record<string, unknown>
  if (typeof intention !== "string") return null
  if (type !== undefined && type !== "vente" && type !== "audit") return null
  let text = intention.slice(0, INTENTION_MAX_LENGTH)
  // Ne coupe pas un caractère en deux (émoji, etc.).
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
  return type ? { type, intention: text } : { intention: text }
}

export function saveBookingPrefill(prefill: BookingPrefill) {
  try {
    sessionStorage.setItem(BOOKING_PREFILL_KEY, JSON.stringify(prefill))
    return true
  } catch {
    return false
  }
}

// Lit puis supprime la valeur : le préremplissage ne sert qu'une fois.
export function takeBookingPrefill(): BookingPrefill | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_PREFILL_KEY)
    sessionStorage.removeItem(BOOKING_PREFILL_KEY)
    return parseBookingPrefill(raw)
  } catch {
    return null
  }
}
