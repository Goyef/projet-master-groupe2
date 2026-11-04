"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { useLocale } from "@/components/i18n/locale-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"
import { format, formatDateTime } from "@/lib/format"
import { intlLocales } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { addDays, dayLabel, monthDays, parisTime, sameMonth, today, weekDays } from "./calendar-dates"
import type { Appointment } from "./use-portal"

type FreeSlot = { id: number; starts: number; ends: number }
type View = "week" | "month"
type CalendarItem = { kind: "appointment"; value: Appointment } | { kind: "free"; value: FreeSlot }

type AdminCalendarProps = {
  appointments: Appointment[]
  freeSlots: FreeSlot[]
  dict: Texts["portal"]["dashboard"]
  types: Texts["types"]
  busy: boolean
  onSelect: (appointment: Appointment) => void
  onRemoveSlot: (slotId: number) => void
}

// Libellé du type ; un type retiré depuis (anciennes données) s'affiche tel qu'il est enregistré.
export const typeLabel = (types: Texts["types"], type: string) => types[type as keyof Texts["types"]] ?? type

// Couleur d'un rendez-vous selon son type (couleurs de la marque) ; annulé = grisé et barré.
export function appointmentTone(item: Appointment) {
  if (item.status === "cancelled") return "border-border bg-muted text-muted-foreground line-through opacity-80"
  if (item.type === "suivi") return "border-primary bg-primary text-primary-foreground"
  if (item.type === "audit") return "border-brand-champagne bg-brand-champagne text-brand-navy"
  return "border-brand-sky bg-brand-diamond text-brand-navy"
}

const HOUR_PX = 56

type Placed<T> = { item: T; start: number; end: number; lane: number; lanes: number }

// Répartit en colonnes les éléments d'un jour qui se chevauchent.
function placeInLanes<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const placed: Placed<T>[] = []
  let group: Placed<T>[] = []
  let groupEnd = -1
  const close = () => {
    const lanes = Math.max(1, ...group.map((entry) => entry.lane + 1))
    for (const entry of group) entry.lanes = lanes
    placed.push(...group)
    group = []
  }
  for (const entry of sorted) {
    if (entry.start >= groupEnd && group.length) close()
    const used = new Set(group.filter((other) => other.end > entry.start).map((other) => other.lane))
    let lane = 0
    while (used.has(lane)) lane++
    group.push({ ...entry, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, entry.end)
  }
  if (group.length) close()
  return placed
}

export function AdminCalendar({ appointments, freeSlots, dict, types, busy, onSelect, onRemoveSlot }: AdminCalendarProps) {
  const locale = useLocale()
  const intl = intlLocales[locale]
  const [view, setView] = useState<View>("week")
  const [anchor, setAnchor] = useState(today)
  const [slotToRemove, setSlotToRemove] = useState<FreeSlot | null>(null)
  // Ligne « maintenant », rafraîchie chaque minute.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const current = parisTime(now)

  const time = (value: number) =>
    new Date(value).toLocaleTimeString(intl, { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })

  // Rendez-vous et créneaux libres, indexés par jour (heure de Paris).
  const byDay = useMemo(() => {
    const days = new Map<string, { appointments: Appointment[]; free: FreeSlot[] }>()
    const entry = (day: string) => {
      if (!days.has(day)) days.set(day, { appointments: [], free: [] })
      return days.get(day)!
    }
    for (const item of appointments) entry(parisTime(item.starts).day).appointments.push(item)
    for (const slot of freeSlots) entry(parisTime(slot.starts).day).free.push(slot)
    for (const value of days.values()) value.appointments.sort((a, b) => a.starts - b.starts)
    return days
  }, [appointments, freeSlots])

  const days = view === "week" ? weekDays(anchor) : monthDays(anchor)
  const step = (direction: number) =>
    setAnchor((day) => {
      if (view === "week") return addDays(day, 7 * direction)
      const [year, month] = day.split("-").map(Number)
      const target = new Date(Date.UTC(year, month - 1 + direction, 1))
      return target.toISOString().slice(0, 10)
    })

  const title =
    view === "week"
      ? `${dayLabel(days[0], intl, { day: "numeric", month: "short" })} – ${dayLabel(days[6], intl, { day: "numeric", month: "short", year: "numeric" })}`
      : dayLabel(anchor, intl, { month: "long", year: "numeric" })

  // Plage horaire de la semaine : 8 h – 20 h, élargie si un élément en sort.
  const range = useMemo(() => {
    let first = 8
    let last = 20
    for (const day of days) {
      const items = byDay.get(day)
      if (!items) continue
      for (const value of [...items.appointments, ...items.free]) {
        const start = parisTime(value.starts).minutes
        first = Math.min(first, Math.floor(start / 60))
        last = Math.max(last, Math.ceil((start + (value.ends - value.starts) / 60_000) / 60))
      }
    }
    return { first, last: Math.min(24, last) }
  }, [days, byDay])
  const hours = Array.from({ length: range.last - range.first }, (_, index) => range.first + index)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={dict.previous} onClick={() => step(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(today())}>
            {dict.today}
          </Button>
          <Button variant="outline" size="icon" aria-label={dict.next} onClick={() => step(1)}>
            <ChevronRightIcon />
          </Button>
          <h3 className="ml-2 font-heading text-xl font-semibold first-letter:uppercase">{title}</h3>
        </div>
        <Tabs value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList>
            <TabsTrigger value="week">{dict.viewWeek}</TabsTrigger>
            <TabsTrigger value="month">{dict.viewMonth}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {(["vente", "audit", "suivi"] as const).map((type) => (
          <li key={type} className="flex items-center gap-2">
            <span
              className={cn(
                "size-3 rounded-sm border",
                appointmentTone({ type, status: "confirmed" } as Appointment),
              )}
            />
            {types[type]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm border border-dashed border-muted-foreground/60" />
          {dict.legendFree}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm border bg-muted" />
          {dict.legendCancelled}
        </li>
      </ul>

      {view === "week" ? (
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[760px] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="border-b bg-muted/40" />
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setAnchor(day)
                }}
                className={cn(
                  "border-b border-l bg-muted/40 px-2 py-2 text-left text-sm",
                  day === current.day && "bg-accent text-accent-foreground",
                )}
              >
                <span className="block text-xs text-muted-foreground first-letter:uppercase">
                  {dayLabel(day, intl, { weekday: "short" })}
                </span>
                <span className="font-semibold">{dayLabel(day, intl, { day: "numeric", month: "short" })}</span>
              </button>
            ))}

            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((hour, index) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                  style={{ top: index * HOUR_PX }}
                >
                  {index ? `${String(hour).padStart(2, "0")}:00` : ""}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const items = byDay.get(day)
              const top = (minutes: number) => ((minutes - range.first * 60) / 60) * HOUR_PX
              const placed = placeInLanes<CalendarItem>([
                ...(items?.appointments ?? []).map((item) => {
                  const start = parisTime(item.starts).minutes
                  return { item: { kind: "appointment" as const, value: item }, start, end: start + (item.ends - item.starts) / 60_000 }
                }),
                ...(items?.free ?? []).map((slot) => {
                  const start = parisTime(slot.starts).minutes
                  return { item: { kind: "free" as const, value: slot }, start, end: start + (slot.ends - slot.starts) / 60_000 }
                }),
              ])
              return (
                <div
                  key={day}
                  className={cn("relative border-l", day === current.day && "bg-accent/30")}
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((hour, index) => (
                    <div key={hour} className="absolute inset-x-0 border-t border-border/60" style={{ top: index * HOUR_PX }} />
                  ))}
                  {day === current.day && current.minutes >= range.first * 60 && current.minutes <= range.last * 60 && (
                    <div className="absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: top(current.minutes) }} />
                  )}
                  {placed.map(({ item, start, end, lane, lanes }) => {
                    const style = {
                      top: top(start) + 1,
                      height: Math.max(((end - start) / 60) * HOUR_PX - 2, 22),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }
                    if (item.kind === "free")
                      return (
                        <button
                          key={`slot-${item.value.id}`}
                          type="button"
                          disabled={busy}
                          onClick={() => setSlotToRemove(item.value)}
                          title={`${dict.freeSlot} · ${time(item.value.starts)}`}
                          className="absolute overflow-hidden rounded-md border border-dashed border-muted-foreground/50 bg-background/60 px-1.5 py-0.5 text-left text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                          style={style}
                        >
                          {time(item.value.starts)} · {dict.freeSlot}
                        </button>
                      )
                    const appointment = item.value
                    return (
                      <button
                        key={`appointment-${appointment.id}`}
                        type="button"
                        onClick={() => onSelect(appointment)}
                        className={cn(
                          "absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-sm transition hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          appointmentTone(appointment),
                        )}
                        style={style}
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          {appointment.completed && <CheckIcon className="size-3 shrink-0" aria-label={dict.legendDone} />}
                          <span className="truncate">{appointment.name}</span>
                        </span>
                        <span className="block truncate opacity-85">
                          {time(appointment.starts)} · {typeLabel(types, appointment.type)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[720px] grid-cols-7">
            {days.slice(0, 7).map((day) => (
              <div key={day} className="border-b bg-muted/40 px-2 py-2 text-xs text-muted-foreground first-letter:uppercase">
                {dayLabel(day, intl, { weekday: "short" })}
              </div>
            ))}
            {days.map((day, index) => {
              const items = byDay.get(day)
              const shown = items?.appointments.slice(0, 3) ?? []
              const hidden = (items?.appointments.length ?? 0) - shown.length
              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-28 space-y-1 border-b p-1.5",
                    index % 7 && "border-l",
                    !sameMonth(day, anchor) && "bg-muted/30 text-muted-foreground",
                    day === current.day && "bg-accent/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAnchor(day)
                      setView("week")
                    }}
                    className="flex w-full items-center justify-between rounded px-1 text-sm font-semibold hover:bg-muted"
                  >
                    {Number(day.slice(8))}
                    {!!items?.free.length && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {items.free.length} {dict.freeSlot.toLowerCase()}
                      </span>
                    )}
                  </button>
                  {shown.map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onSelect(appointment)}
                      className={cn(
                        "block w-full truncate rounded border px-1.5 py-0.5 text-left text-xs",
                        appointmentTone(appointment),
                      )}
                    >
                      {time(appointment.starts)} {appointment.name}
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAnchor(day)
                        setView("week")
                      }}
                      className="px-1 text-xs text-muted-foreground hover:underline"
                    >
                      {format(dict.more, { count: hidden })}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AlertDialog open={!!slotToRemove} onOpenChange={(open) => !open && setSlotToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.removeSlotTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {slotToRemove && format(dict.removeSlotText, { date: formatDateTime(slotToRemove.starts, locale) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.keep}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (slotToRemove) onRemoveSlot(slotToRemove.id)
                setSlotToRemove(null)
              }}
            >
              {dict.removeSlotConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
