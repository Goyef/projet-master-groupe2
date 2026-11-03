"use client"

import { useDateFormatter, useLocalizedFetch } from "@/components/i18n/locale-provider"

import { useEffect, useRef, useState } from "react"
import { CalendarClockIcon, XIcon } from "lucide-react"

import { SlotPicker, type Slot } from "@/components/booking/slot-picker"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldSet } from "@/components/ui/field"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import type { Appointment, Portal } from "./use-portal"

type ActionProps = {
  appointment: Appointment
  dict: Texts["portal"]["client"]
  types: Texts["types"]
  loadingLabel: string
  portal: Portal
  // Boutons clairs sur fond foncé (carte « prochain rendez-vous »).
  inverted?: boolean
}

const CHANGE_NOTICE_MS = 24 * 3600_000

function RescheduleDialog({ appointment, dict, types, loadingLabel, portal, inverted }: ActionProps) {
  const formatDateTime = useDateFormatter()
  const localizedFetch = useLocalizedFetch()
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [slot, setSlot] = useState("")
  const scope = `reschedule-${appointment.id}`
  const { act, busy, feedbackFor, errorFor, setMessage } = portal

  // Créneaux libres du même type, à plus de 24 h, chargés à l'ouverture.
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    localizedFetch(`/api/portal?action=slots&type=${appointment.type}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        const limit = Date.now() + CHANGE_NOTICE_MS
        setSlots((data.slots as Slot[]).filter((item) => item.starts > limit))
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return
        setSlots([])
        setMessage({ ok: false, text: error.message, scope })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open, appointment.type, scope, setMessage, localizedFetch])

  // Un seul déplacement à la fois : un double clic n'envoie pas deux demandes.
  const submitting = useRef(false)
  async function confirm() {
    if (submitting.current) return
    submitting.current = true
    let starts = 0
    const done = await act(
      { action: "reschedule", id: appointment.id, slot: Number(slot) },
      {
        scope,
        success: (result) => {
          starts = Number(result.starts)
          return ""
        },
      },
    ).finally(() => {
      submitting.current = false
    })
    if (!done) return
    setOpen(false)
    setMessage({ ok: true, text: format(dict.rescheduled, { date: formatDateTime(starts) }), scope: "appointments" })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setSlot("")
        setLoading(true)
        if (!next) setMessage(null)
      }}
    >
      <DialogTrigger render={<Button size="sm" variant={inverted ? "secondary" : "outline"} />}>
        <CalendarClockIcon data-icon="inline-start" />
        {dict.reschedule}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{dict.rescheduleTitle}</DialogTitle>
          <DialogDescription>
            {format(dict.rescheduleText, {
              type: types[appointment.type],
              date: formatDateTime(appointment.starts),
            })}
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <SlotPicker
            slots={slots}
            value={slot}
            onChange={setSlot}
            loading={loading}
            loadingLabel={loadingLabel}
            emptyLabel={dict.rescheduleEmpty}
            idPrefix={`reschedule-${appointment.id}`}
          />
          {errorFor(scope, "slot")}
        </FieldSet>
        {feedbackFor(scope)}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{dict.close}</DialogClose>
          <Button disabled={busy || !slot} onClick={confirm}>
            {busy ? dict.rescheduling : dict.rescheduleConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ appointment, dict, types, portal, inverted }: ActionProps) {
  const formatDateTime = useDateFormatter()
  const [open, setOpen] = useState(false)
  const { act, busy } = portal
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={inverted ? "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" : ""}
          />
        }
      >
        <XIcon data-icon="inline-start" />
        {dict.cancel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dict.cancelTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {format(dict.cancelText, { type: types[appointment.type], date: formatDateTime(appointment.starts) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dict.cancelKeep}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              await act({ action: "cancel", id: appointment.id }, { scope: "appointments", success: () => dict.cancelled })
              setOpen(false)
            }}
          >
            {busy ? dict.cancelling : dict.cancelConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Actions du client sur un rendez-vous : déplacer ou annuler, jusqu'à 24 h avant.
export function AppointmentActions(props: ActionProps) {
  if (!props.appointment.changeable) return null
  return (
    <div className="flex flex-wrap gap-2">
      <RescheduleDialog {...props} />
      <CancelDialog {...props} />
    </div>
  )
}
