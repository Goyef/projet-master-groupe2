"use client"

import { useMemo } from "react"
import { XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format, TIME_ZONE } from "@/lib/format"

// `waitlist` : clients en liste d'attente sur ce créneau réservé, dans l'ordre d'inscription.
type ScheduledSlot = { id: number; starts: number; ends: number; appointment_id: number | null; waitlist?: string[] }

type SlotScheduleProps = {
  slots: ScheduledSlot[]
  busy: boolean
  onRemove: (id: number) => void
  labels: { booked: string; removeSlot: string; slotCount: string; waitlistCount: string }
}

const time = (value: number) =>
  new Date(value).toLocaleTimeString("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" })

// Disponibilités à venir, regroupées par jour (heure de Paris) en pastilles compactes :
// une ligne par jour au lieu d'une ligne par créneau, lisible sur téléphone.
export function SlotSchedule({ slots, busy, onRemove, labels }: SlotScheduleProps) {
  const days = useMemo(() => {
    const groups = new Map<string, ScheduledSlot[]>()
    for (const slot of slots) {
      const day = new Date(slot.starts).toLocaleDateString("fr-FR", {
        timeZone: TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      groups.set(day, [...(groups.get(day) ?? []), slot])
    }
    return [...groups]
  }, [slots])

  return (
    <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
      {days.map(([day, items]) => (
        <section key={day} className="space-y-2">
          <h3 className="font-sans text-sm font-medium first-letter:uppercase">
            {day}{" "}
            <span className="font-normal text-muted-foreground">
              · {format(labels.slotCount, { count: items.length })}
            </span>
          </h3>
          <ul className="flex flex-wrap gap-2">
            {items.map((slot) => {
              const range = `${time(slot.starts)}–${time(slot.ends)}`
              return (
                <li key={slot.id}>
                  {slot.appointment_id ? (
                    <div className="space-y-1">
                      <Badge variant="secondary" className="h-7">
                        {time(slot.starts)} · {labels.booked}
                        {!!slot.waitlist?.length && ` · ${format(labels.waitlistCount, { count: slot.waitlist.length })}`}
                      </Badge>
                      {!!slot.waitlist?.length && (
                        <p className="max-w-48 text-xs text-muted-foreground">{slot.waitlist.join(", ")}</p>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={format(labels.removeSlot, { day, range })}
                      title={range}
                      onClick={() => onRemove(slot.id)}
                    >
                      {time(slot.starts)}
                      <XIcon data-icon="inline-end" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
