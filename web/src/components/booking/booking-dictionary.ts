import type { Texts } from "@/content/texts"
import type { BookingFormProps } from "./booking-form"

// Sous-ensemble des textes transmis au formulaire (composant client).
export function bookingDictionary(dict: Texts): BookingFormProps["dict"] {
  return {
    types: dict.types,
    formats: dict.formats,
    minutes: dict.minutes,
    errors: dict.errors,
    form: dict.booking.form,
    calendar: dict.calendar,
  }
}
