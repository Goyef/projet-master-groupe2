"use client"

import { useState } from "react"
import { CheckCircle2Icon, CircleIcon, FileTextIcon, ListChecksIcon, NotebookPenIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react"

import { useDateFormatter } from "@/components/i18n/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"
import { cn } from "@/lib/utils"

import { QUIET_ON_PRIMARY } from "./appointment-actions"
import type { Appointment, Portal } from "./use-portal"

// Préparation de séance (client), compte rendu et actions (rédigés par le gérant, cochés par le client).
// Données renvoyées par l'API dans `sessionNotes` : seulement les rendez-vous confirmés avec compte.

export type SessionAction = { id: number; label: string; done: boolean }
export type SessionReport = { summary: string; publishedAt: number; updatedAt: number; actions: SessionAction[] }
export type SessionNote = { appointmentId: number; preparation: string | null; report: SessionReport | null }

type Dict = Texts["portal"]["sessionNotes"]

// Limites vérifiées aussi côté serveur (`src/lib/store.ts`).
const PREPARATION_MAX = 1000
const SUMMARY_MAX = 3000
const ACTIONS_MAX = 5
const ACTION_MAX = 200

export function sessionNoteFor(portal: Portal, appointmentId: number) {
  return portal.data?.sessionNotes?.find((note) => note.appointmentId === appointmentId)
}

function Counter({ dict, count, max }: { dict: Dict; count: number; max: number }) {
  return <FieldDescription className="tabular-nums">{format(dict.counter, { count, max })}</FieldDescription>
}

// --- Client ------------------------------------------------------------------

type ClientProps = {
  appointment: Appointment
  dict: Dict
  types: Texts["types"]
  portal: Portal
  // Boutons clairs sur fond foncé (carte « prochain rendez-vous »).
  inverted?: boolean
  // Sur fond foncé, bouton discret quand une autre action est principale.
  quiet?: boolean
}

// « Ce que j'aimerais aborder » : modifiable jusqu'au début du rendez-vous (vérifié par le serveur).
export function PreparationDialog({ appointment, dict, types, portal, inverted, quiet }: ClientProps) {
  const formatDateTime = useDateFormatter()
  const { act, busy, feedbackFor, errorFor, isInvalid, setMessage } = portal
  const saved = sessionNoteFor(portal, appointment.id)?.preparation ?? ""
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(saved)
  const scope = `preparation-${appointment.id}`

  async function save() {
    const done = await act(
      { action: "save-preparation", id: appointment.id, preparation: value },
      { scope, success: () => dict.prepareSaved },
    )
    if (!done) return
    setOpen(false)
    setMessage({ ok: true, text: dict.prepareSaved, scope: "appointments" })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setValue(saved)
        if (!next) setMessage(null)
      }}
    >
      <DialogTrigger
        render={
          inverted && quiet ? (
            <Button size="sm" variant="ghost" className={QUIET_ON_PRIMARY} />
          ) : (
            <Button size="sm" variant={inverted ? "secondary" : "outline"} />
          )
        }
      >
        <NotebookPenIcon data-icon="inline-start" />
        {saved ? dict.prepareEdit : dict.prepare}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{dict.prepareTitle}</DialogTitle>
          <DialogDescription>
            {format(dict.prepareText, { type: types[appointment.type], date: formatDateTime(appointment.starts) })}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`${scope}-text`} className="sr-only">
            {dict.prepareLabel}
          </FieldLabel>
          <Textarea
            id={`${scope}-text`}
            className="min-h-40"
            maxLength={PREPARATION_MAX}
            value={value}
            aria-invalid={isInvalid(scope, "preparation")}
            onChange={(event) => setValue(event.target.value)}
          />
          <Counter dict={dict} count={value.length} max={PREPARATION_MAX} />
          {errorFor(scope, "preparation")}
        </Field>
        {feedbackFor(scope)}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{dict.close}</DialogClose>
          <Button disabled={busy || value === saved} onClick={save}>
            {busy ? dict.saving : dict.prepareSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Badge « Préparation notée » à côté d'un rendez-vous à venir.
export function PreparationBadge({ appointment, dict, portal }: Omit<ClientProps, "types">) {
  if (!sessionNoteFor(portal, appointment.id)?.preparation) return null
  return <Badge variant="outline">{dict.prepared}</Badge>
}

// Liste des actions, cochables par le client.
function ActionChecklist({ actions, dict, portal, scope }: { actions: SessionAction[]; dict: Dict; portal: Portal; scope: string }) {
  const { act, busy, feedbackFor } = portal
  if (!actions.length) return <p className="text-sm text-muted-foreground">{dict.actionsEmpty}</p>
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {actions.map((action) => (
          <li key={action.id}>
            <Field orientation="horizontal">
              <Checkbox
                id={`session-action-${scope}-${action.id}`}
                checked={action.done}
                disabled={busy}
                onCheckedChange={(checked) =>
                  act({ action: "session-action", id: action.id, done: checked === true }, { scope, success: () => dict.actionSaved })
                }
              />
              <FieldLabel
                htmlFor={`session-action-${scope}-${action.id}`}
                className={cn("font-normal", action.done && "text-muted-foreground line-through")}
              >
                {action.label}
              </FieldLabel>
            </Field>
          </li>
        ))}
      </ul>
      {feedbackFor(scope)}
    </div>
  )
}

function ReportBody({ note, dict, portal, scope }: { note: SessionNote & { report: SessionReport }; dict: Dict; portal: Portal; scope: string }) {
  const formatDateTime = useDateFormatter()
  const { report } = note
  const done = report.actions.filter((action) => action.done).length
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{report.summary}</p>
      <p className="text-xs text-muted-foreground first-letter:uppercase">
        {format(report.updatedAt > report.publishedAt ? dict.updatedOn : dict.publishedOn, {
          date: formatDateTime(report.updatedAt),
        })}
      </p>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{dict.actionsTitle}</h3>
          {report.actions.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {format(dict.actionsProgress, { done, total: report.actions.length })}
            </Badge>
          )}
        </div>
        <ActionChecklist actions={report.actions} dict={dict} portal={portal} scope={scope} />
      </section>
      {note.preparation && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{dict.yourPreparation}</h3>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{note.preparation}</p>
        </section>
      )}
    </div>
  )
}

// Compte rendu d'un rendez-vous passé, lu par le client ; rien si Youcef n'en a pas publié.
export function SessionReportDialog({ appointment, dict, types, portal, label }: ClientProps & { label?: string }) {
  const formatDateTime = useDateFormatter()
  const note = sessionNoteFor(portal, appointment.id)
  const { setMessage } = portal
  if (!note?.report) return null
  return (
    <Dialog onOpenChange={(open) => !open && setMessage(null)}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileTextIcon data-icon="inline-start" />
        {label ?? dict.reportOpen}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{dict.reportTitle}</DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {format(dict.reportText, { type: types[appointment.type], date: formatDateTime(appointment.starts) })}
          </DialogDescription>
        </DialogHeader>
        <ReportBody note={{ ...note, report: note.report }} dict={dict} portal={portal} scope={`report-${appointment.id}`} />
      </DialogContent>
    </Dialog>
  )
}

// Tableau de bord du client : actions encore ouvertes de la dernière séance avec compte rendu.
export function OpenSessionActions({ dict, types, portal }: Omit<ClientProps, "appointment" | "inverted">) {
  const formatDateTime = useDateFormatter()
  const last = (portal.data?.appointments ?? [])
    .filter((item) => item.status === "confirmed" && item.past && sessionNoteFor(portal, item.id)?.report)
    .sort((a, b) => b.starts - a.starts)[0]
  const actions = last ? sessionNoteFor(portal, last.id)?.report?.actions ?? [] : []
  const open = actions.filter((action) => !action.done)
  if (!last || !open.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ListChecksIcon className="size-5 text-brand-sky" />
          {dict.highlightTitle}
        </CardTitle>
        <CardDescription className="first-letter:uppercase">
          {format(dict.highlightText, { date: formatDateTime(last.starts) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActionChecklist actions={open} dict={dict} portal={portal} scope="open-actions" />
        <SessionReportDialog appointment={last} dict={dict} types={types} portal={portal} label={dict.highlightRead} />
      </CardContent>
    </Card>
  )
}

// --- Gérant ------------------------------------------------------------------

type DraftAction = { key: number; id?: number; label: string }
const SHEET_SCOPE = "session-report"

// Encart du panneau de rendez-vous : préparation du client, puis compte rendu une fois la séance
// réalisée. Rien pour un rendez-vous sans compte ou annulé.
export function SessionNotesPanel({ appointment, dict, portal }: { appointment: Appointment; dict: Dict; portal: Portal }) {
  const formatDateTime = useDateFormatter()
  const { act, busy, feedbackFor, errorFor, isInvalid } = portal
  const note = sessionNoteFor(portal, appointment.id)
  const report = note?.report ?? null
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState("")
  const [actions, setActions] = useState<DraftAction[]>([])
  const [nextKey, setNextKey] = useState(0)
  if (!appointment.client || appointment.status !== "confirmed") return null

  function startEditing() {
    const existing = (report?.actions ?? []).map((action, index) => ({ key: index, id: action.id, label: action.label }))
    setSummary(report?.summary ?? "")
    setActions(existing.length ? existing : [{ key: existing.length, label: "" }])
    setNextKey(existing.length + 1)
    setEditing(true)
  }

  async function save() {
    const first = !report
    const done = await act(
      {
        action: "session-report",
        id: appointment.id,
        summary,
        actions: actions
          .filter((action) => action.label.trim())
          .map((action) => ({ id: action.id, label: action.label.trim() })),
      },
      { scope: SHEET_SCOPE, success: () => (first ? dict.published : dict.updated) },
    )
    if (done) setEditing(false)
  }

  const showReport = appointment.past || !!report
  if (!note?.preparation && !showReport) return null

  return (
    <div className="space-y-6">
      {note?.preparation && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">{dict.adminPreparation}</h3>
          <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{note.preparation}</p>
        </section>
      )}

      {showReport && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{dict.adminReport}</h3>
            {report && !editing && appointment.completed && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={startEditing}>
                <PencilIcon data-icon="inline-start" />
                {dict.adminEdit}
              </Button>
            )}
          </div>

          {editing ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`summary-${appointment.id}`} data-invalid={isInvalid(SHEET_SCOPE, "summary")}>
                  {dict.summaryLabel}
                </FieldLabel>
                <Textarea
                  id={`summary-${appointment.id}`}
                  className="min-h-40"
                  maxLength={SUMMARY_MAX}
                  value={summary}
                  aria-invalid={isInvalid(SHEET_SCOPE, "summary")}
                  onChange={(event) => setSummary(event.target.value)}
                />
                <Counter dict={dict} count={summary.length} max={SUMMARY_MAX} />
                {errorFor(SHEET_SCOPE, "summary")}
              </Field>
              <FieldSet>
                <FieldLegend variant="label">{dict.actionsLabel}</FieldLegend>
                <div className="space-y-2">
                  {actions.map((action, index) => (
                    <div key={action.key} className="flex items-center gap-2">
                      <Input
                        aria-label={format(dict.actionPlaceholder, { number: index + 1 })}
                        placeholder={format(dict.actionPlaceholder, { number: index + 1 })}
                        maxLength={ACTION_MAX}
                        value={action.label}
                        aria-invalid={isInvalid(SHEET_SCOPE, "actions")}
                        onChange={(event) =>
                          setActions((list) =>
                            list.map((item) => (item.key === action.key ? { ...item, label: event.target.value } : item)),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={format(dict.actionRemove, { number: index + 1 })}
                        onClick={() => setActions((list) => list.filter((item) => item.key !== action.key))}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>
                {actions.length < ACTIONS_MAX && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      setActions((list) => [...list, { key: nextKey, label: "" }])
                      setNextKey((key) => key + 1)
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    {dict.actionAdd}
                  </Button>
                )}
                {errorFor(SHEET_SCOPE, "actions")}
              </FieldSet>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !summary.trim()} onClick={save}>
                  {busy ? dict.saving : report ? dict.update : dict.publish}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setEditing(false)}>
                  {dict.cancelEdit}
                </Button>
              </div>
            </FieldGroup>
          ) : report ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-line">{report.summary}</p>
              <p className="text-xs text-muted-foreground first-letter:uppercase">
                {format(report.updatedAt > report.publishedAt ? dict.updatedOn : dict.publishedOn, {
                  date: formatDateTime(report.updatedAt),
                })}
              </p>
              {report.actions.length > 0 && (
                <ul className="space-y-1.5">
                  {report.actions.map((action) => (
                    <li key={action.id} className="flex items-start gap-2 text-sm">
                      {action.done ? (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-brand-sky" aria-label={dict.actionDone} />
                      ) : (
                        <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={dict.actionOpen} />
                      )}
                      <span className={cn(action.done && "text-muted-foreground line-through")}>{action.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : appointment.completed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{dict.adminReportIntro}</p>
              <Button variant="outline" disabled={busy} onClick={startEditing}>
                <NotebookPenIcon data-icon="inline-start" />
                {dict.adminWrite}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.adminNotCompleted}</p>
          )}
          {feedbackFor(SHEET_SCOPE)}
        </section>
      )}
    </div>
  )
}
