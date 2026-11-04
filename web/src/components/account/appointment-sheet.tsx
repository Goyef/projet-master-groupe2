"use client"

import { useState } from "react"
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  MailIcon,
  PhoneIcon,
  Trash2Icon,
  VideoIcon,
  XCircleIcon,
} from "lucide-react"

import { SlotPicker, type Slot } from "@/components/booking/slot-picker"
import { useDateFormatter, useLocalizedFetch } from "@/components/i18n/locale-provider"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import { typeLabel } from "./admin-calendar"
import { SessionNotesPanel } from "./session-notes"
import { ClientMoodSummary } from "./mood-journal"

import type { Appointment, Portal } from "./use-portal"

type AppointmentSheetProps = {
  appointment: Appointment | null
  onClose: () => void
  dict: Texts["portal"]
  types: Texts["types"]
  formats: Texts["formats"]
  loadingLabel: string
  portal: Portal
}

type Confirm = "cancel" | "delete" | null

// Message de retour affiché au-dessus du calendrier une fois le panneau fermé.
export const CALENDAR_SCOPE = "calendar"
const SHEET_SCOPE = "appointment-sheet"

// Panneau d'un rendez-vous côté gérant : coordonnées, intention, et actions (déplacer, annuler,
// supprimer, marquer réalisé). Le client est prévenu par e-mail sauf si la case est décochée.
// À rendre avec `key={appointment.id}` : chaque rendez-vous repart de la vue « détails ».
export function AppointmentSheet({ appointment, onClose, dict, types, formats, loadingLabel, portal }: AppointmentSheetProps) {
  const text = dict.dashboard
  const formatDateTime = useDateFormatter()
  const localizedFetch = useLocalizedFetch()
  const { act, busy, feedbackFor, setMessage } = portal
  const [moving, setMoving] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slot, setSlot] = useState("")
  const [notify, setNotify] = useState(true)
  const [confirm, setConfirm] = useState<Confirm>(null)

  async function startMoving() {
    if (!appointment) return
    setMoving(true)
    setLoadingSlots(true)
    try {
      const response = await localizedFetch(`/api/portal?action=slots&type=${appointment.type}`)
      const data = await response.json()
      setSlots(response.ok ? data.slots : [])
      if (!response.ok) setMessage({ ok: false, text: data.error, scope: SHEET_SCOPE })
    } finally {
      setLoadingSlots(false)
    }
  }

  // Lance l'action ; en cas de succès, ferme le panneau et affiche le message sur le calendrier.
  async function run(payload: Record<string, unknown>, success: (result: Record<string, string | number>) => string) {
    let confirmation = ""
    const done = await act(payload, {
      scope: SHEET_SCOPE,
      success: (result) => (confirmation = success(result)),
    })
    if (!done) return
    onClose()
    setMessage({ ok: true, text: confirmation, scope: CALENDAR_SCOPE })
  }

  const item = appointment
  const values = item
    ? { type: typeLabel(types, item.type), name: item.name, date: formatDateTime(item.starts) }
    : { type: "", name: "", date: "" }
  const upcoming = !!item && item.status === "confirmed" && !item.past
  const minutes = item ? Math.round((item.ends - item.starts) / 60_000) : 0

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg" closeLabel={text.back}>
        {item && (
          <>
            <SheetHeader className="gap-3 border-b pb-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{typeLabel(types, item.type)}</Badge>
                {item.status === "cancelled" ? (
                  <Badge variant="outline">{dict.statusCancelled}</Badge>
                ) : item.completed ? (
                  <Badge>{dict.statusDone}</Badge>
                ) : (
                  <Badge variant="outline">{dict.statusConfirmed}</Badge>
                )}
              </div>
              <SheetTitle className="font-heading text-3xl">{item.name}</SheetTitle>
              <SheetDescription className="text-base first-letter:uppercase">
                {formatDateTime(item.starts)} · {minutes} min · {formats[item.format]}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-4">
              {feedbackFor(SHEET_SCOPE)}

              {moving ? (
                <section className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => setMoving(false)}>
                    <ArrowLeftIcon data-icon="inline-start" />
                    {text.back}
                  </Button>
                  <h3 className="font-heading text-xl font-semibold">{text.moveTitle}</h3>
                  <SlotPicker
                    slots={slots}
                    value={slot}
                    onChange={setSlot}
                    loading={loadingSlots}
                    loadingLabel={loadingLabel}
                    emptyLabel={text.moveEmpty}
                    idPrefix={`owner-move-${item.id}`}
                  />
                  <NotifyField id="notify-move" checked={notify} onChange={setNotify} label={text.notify} />
                  <Button
                    className="w-full"
                    disabled={busy || !slot}
                    onClick={() =>
                      run({ action: "owner-reschedule", id: item.id, slot: Number(slot), notify }, (result) =>
                        format(text.moved, { date: formatDateTime(Number(result.starts)) }),
                      )
                    }
                  >
                    {text.moveConfirm}
                  </Button>
                </section>
              ) : (
                <>
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">{text.contact}</h3>
                    <ul className="space-y-2">
                      <li>
                        <Button variant="link" className="h-auto px-0" render={<a href={`mailto:${item.email}`} />} nativeButton={false}>
                          <MailIcon data-icon="inline-start" />
                          {item.email}
                        </Button>
                      </li>
                      {item.phone && (
                        <li>
                          <Button variant="link" className="h-auto px-0" render={<a href={`tel:${item.phone.replace(/\s/g, "")}`} />} nativeButton={false}>
                            <PhoneIcon data-icon="inline-start" />
                            {item.phone}
                          </Button>
                        </li>
                      )}
                      <li className="text-sm text-muted-foreground">{item.client ? text.profileClient : text.profileProspect}</li>
                    </ul>
                  </section>

                  {item.format === "visio" && item.status === "confirmed" && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{text.meet}</h3>
                      {item.meetUrl ? (
                        <Button
                          variant="link"
                          className="h-auto max-w-full px-0"
                          render={<a href={item.meetUrl} target="_blank" rel="noopener noreferrer" />}
                          nativeButton={false}
                        >
                          <VideoIcon data-icon="inline-start" />
                          <span className="truncate">{item.meetUrl.replace(/^https:\/\//, "")}</span>
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">{text.meetPending}</p>
                      )}
                    </section>
                  )}

                  {item.intention && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{text.intention}</h3>
                      <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{item.intention}</p>
                    </section>
                  )}

                  <SessionNotesPanel appointment={item} dict={dict.sessionNotes} portal={portal} />
                  <ClientMoodSummary userId={item.userId} dict={dict.mood} portal={portal} />

                  <Separator />

                  <section className="grid gap-2">
                    {item.status === "confirmed" && (
                      <Button variant="outline" disabled={busy} onClick={startMoving}>
                        <CalendarClockIcon data-icon="inline-start" />
                        {text.move}
                      </Button>
                    )}
                    {item.status === "confirmed" && item.past && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "complete", id: item.id }, () => dict.saved)
                        }
                      >
                        <CheckCircle2Icon data-icon="inline-start" />
                        {item.completed ? dict.unmarkDone : dict.markDone}
                      </Button>
                    )}
                    {item.status === "confirmed" && (
                      <Button variant="outline" disabled={busy} onClick={() => setConfirm("cancel")}>
                        <XCircleIcon data-icon="inline-start" />
                        {text.cancel}
                      </Button>
                    )}
                    <Button variant="destructive" disabled={busy} onClick={() => setConfirm("delete")}>
                      <Trash2Icon data-icon="inline-start" />
                      {text.delete}
                    </Button>
                  </section>
                </>
              )}
            </div>

            <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{confirm === "delete" ? text.deleteTitle : text.cancelTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {format(confirm === "delete" ? text.deleteText : text.cancelText, values)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {/* Prévenir le client n'a de sens que pour un rendez-vous encore à venir. */}
                {upcoming && (
                  <NotifyField id="notify-confirm" checked={notify} onChange={setNotify} label={text.notify} />
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>{text.keep}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={busy}
                    onClick={async () => {
                      const action = confirm === "delete" ? "owner-delete" : "owner-cancel"
                      setConfirm(null)
                      await run({ action, id: item.id, notify }, () =>
                        action === "owner-delete" ? text.deleted : text.cancelled,
                      )
                    }}
                  >
                    {confirm === "delete" ? text.deleteConfirm : text.cancelConfirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function NotifyField({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  )
}
