"use client"

import { useMemo } from "react"

import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { TIME_ZONE } from "@/lib/format"

export type Slot = { id: number; starts: number }

type SlotPickerProps = {
  slots: Slot[]
  value: string
  onChange: (value: string) => void
  loading: boolean
  loadingLabel: string
  emptyLabel: string
  // Préfixe des identifiants : plusieurs sélecteurs peuvent coexister sur la page.
  idPrefix?: string
}

// Créneaux regroupés par jour (heure de Paris), un bouton radio par horaire.
export function SlotPicker({
  slots,
  value,
  onChange,
  loading,
  loadingLabel,
  emptyLabel,
  idPrefix = "slot",
}: SlotPickerProps) {
  const days = useMemo(() => {
    const groups = new Map<string, Slot[]>()
    for (const item of slots) {
      const day = new Date(item.starts).toLocaleDateString("fr-FR", {
        timeZone: TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      groups.set(day, [...(groups.get(day) ?? []), item])
    }
    return [...groups]
  }, [slots])

  if (loading)
    return (
      <div className="grid grid-cols-3 gap-2" aria-label={loadingLabel}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
    )

  if (!slots.length) return <FieldDescription>{emptyLabel}</FieldDescription>

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(String(next))}
      className="max-h-72 gap-4 overflow-y-auto pr-1"
    >
      {days.map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="text-sm font-medium first-letter:uppercase">{day}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <FieldLabel
                key={item.id}
                htmlFor={`${idPrefix}-${item.id}`}
                className="has-data-checked:bg-primary has-data-checked:text-primary-foreground"
              >
                <Field orientation="horizontal" className="justify-center">
                  <RadioGroupItem value={String(item.id)} id={`${idPrefix}-${item.id}`} className="sr-only" />
                  <FieldTitle>
                    {new Date(item.starts).toLocaleTimeString("fr-FR", {
                      timeZone: TIME_ZONE,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </FieldTitle>
                </Field>
              </FieldLabel>
            ))}
          </div>
        </div>
      ))}
    </RadioGroup>
  )
}
