"use client"

import { useRef, useState, type FormEvent } from "react"
import {
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSunIcon,
  NotebookPenIcon,
  PencilIcon,
  ShieldCheckIcon,
  SunIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"
import { intlLocales } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { addDays, dayLabel, today } from "./calendar-dates"
import type { Client, MoodEntry, Portal } from "./use-portal"

type MoodDict = Texts["portal"]["mood"]

// Niveaux 1 (orage) à 5 (soleil) : icône météo, toujours accompagnée de son libellé.
const MOOD_ICONS: LucideIcon[] = [CloudLightningIcon, CloudRainIcon, CloudIcon, CloudSunIcon, SunIcon]
const LEVELS = [1, 2, 3, 4, 5]
const NOTE_MAX = 500
const SCOPE = "mood"

function MoodIcon({ mood, className, style }: { mood: number; className?: string; style?: React.CSSProperties }) {
  const Icon = MOOD_ICONS[mood - 1] ?? CloudIcon
  return <Icon aria-hidden className={className} style={style} />
}

// Libellé d'un jour « AAAA-MM-JJ » dans la langue affichée, avec une majuscule initiale.
function useDayLabel() {
  const locale = intlLocales[useLocale()]
  return (day: string, long = false) => {
    const text = dayLabel(
      day,
      locale,
      long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" },
    )
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
}

// Barres en SVG fait main : une colonne par jour, hauteur = niveau d'humeur, trait discret si aucune entrée.
// Le tracé s'étire sur toute la largeur (mobile compris) ; les icônes et dates restent en HTML pour garder leur taille.
export function MoodChart({
  entries,
  days,
  dict,
  compact = false,
}: {
  entries: MoodEntry[]
  days: number
  dict: MoodDict
  compact?: boolean
}) {
  const label = useDayLabel()
  const [active, setActive] = useState<number | null>(null)
  const last = today()
  const keys = Array.from({ length: days }, (_, index) => addDays(last, index - days + 1))
  const byDay = new Map(entries.map((entry) => [entry.day, entry]))
  const recorded = keys.filter((day) => byDay.has(day)).length
  const width = days * 10
  const describe = (day: string) => {
    const entry = byDay.get(day)
    return `${label(day)} · ${entry ? dict.levels[entry.mood - 1] : dict.noEntry}`
  }
  const activeDay = active === null ? null : keys[active]
  const activeEntry = activeDay ? byDay.get(activeDay) : undefined
  const height = compact ? "h-24" : "h-40"

  return (
    <figure className="space-y-2">
      <div className="flex gap-2">
        {/* Axe des niveaux : une icône au milieu de chaque bande. */}
        <div className={cn("relative w-4 shrink-0 text-muted-foreground", height)} aria-hidden>
          {LEVELS.map((level) => (
            <MoodIcon
              key={level}
              mood={level}
              className="absolute left-0 size-4 translate-y-1/2"
              // Centre de la bande du niveau : (niveau − 0,5) × 20 % depuis le bas.
              style={{ bottom: `${(level - 0.5) * 20}%` }}
            />
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} 100`}
          preserveAspectRatio="none"
          className={cn("w-full min-w-0 touch-pan-y overflow-visible", height)}
          role="img"
          aria-label={format(dict.chartLabel, { from: label(keys[0]), to: label(last), count: recorded })}
          onPointerLeave={() => setActive(null)}
        >
          {LEVELS.map((level) => (
            <line
              key={level}
              x1={0}
              x2={width}
              y1={100 - level * 20}
              y2={100 - level * 20}
              className="stroke-border"
              strokeDasharray={level === 5 ? undefined : "2 3"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {keys.map((day, index) => {
            const entry = byDay.get(day)
            const dimmed = active !== null && active !== index
            return (
              <g key={day}>
                {entry ? (
                  <rect
                    x={index * 10 + 1.5}
                    width={7}
                    y={100 - entry.mood * 20}
                    height={entry.mood * 20}
                    className={cn("fill-primary transition-opacity", dimmed && "opacity-35")}
                  />
                ) : (
                  <rect x={index * 10 + 3} width={4} y={98} height={2} className="fill-muted-foreground/40" />
                )}
                {/* Zone de survol plus large que la barre (toute la colonne). */}
                <rect
                  x={index * 10}
                  width={10}
                  y={0}
                  height={100}
                  fill="transparent"
                  onPointerEnter={() => setActive(index)}
                  onPointerDown={() => setActive(index)}
                >
                  <title>{describe(day)}</title>
                </rect>
              </g>
            )
          })}
          <line x1={0} x2={width} y1={100} y2={100} className="stroke-muted-foreground/50" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between gap-2 pl-6 text-xs text-muted-foreground" aria-hidden>
        <span>{label(keys[0])}</span>
        <span>{dict.today}</span>
      </div>
      <figcaption className={cn("min-h-5 text-sm", activeDay ? "text-foreground" : "text-muted-foreground")} aria-live="polite">
        {activeDay ? (
          <span>
            {describe(activeDay)}
            {activeEntry?.note && <span className="text-muted-foreground"> — {activeEntry.note}</span>}
          </span>
        ) : (
          dict.chartHint
        )}
      </figcaption>
    </figure>
  )
}

// Formulaire de l'humeur du jour, ou d'une entrée passée en cours de modification.
function MoodForm({
  entry,
  editing,
  dict,
  portal,
  onDone,
}: {
  entry?: MoodEntry
  editing: boolean
  dict: MoodDict
  portal: Portal
  onDone: () => void
}) {
  const label = useDayLabel()
  const { act, busy, feedbackFor, isInvalid, errorFor } = portal
  const [mood, setMood] = useState(entry?.mood ?? 0)
  const [note, setNote] = useState(entry?.note ?? "")

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const done = await act(
      { action: "save-mood", mood, note, ...(editing && entry ? { id: entry.id } : {}) },
      { scope: SCOPE, success: () => (editing ? dict.updated : dict.saved) },
    )
    if (done) onDone()
  }

  return (
    <form onSubmit={save}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label" data-invalid={isInvalid(SCOPE, "mood")}>
            {editing && entry ? format(dict.editQuestion, { date: label(entry.day, true) }) : dict.question}
          </FieldLegend>
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((level) => (
              <label
                key={level}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-1 py-3 text-center text-xs transition-colors hover:bg-muted sm:text-sm",
                  "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
                  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                )}
              >
                <input
                  type="radio"
                  name="mood"
                  value={level}
                  required
                  checked={mood === level}
                  onChange={() => setMood(level)}
                  className="sr-only"
                />
                <MoodIcon mood={level} className="size-6" />
                <span className="leading-tight break-words hyphens-auto">{dict.levels[level - 1]}</span>
              </label>
            ))}
          </div>
          {errorFor(SCOPE, "mood")}
        </FieldSet>
        <Field>
          <FieldLabel htmlFor="mood-note" data-invalid={isInvalid(SCOPE, "note")}>
            {dict.note}
          </FieldLabel>
          <Textarea
            id="mood-note"
            name="note"
            aria-invalid={isInvalid(SCOPE, "note")}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={dict.notePlaceholder}
            className="min-h-24"
          />
          <FieldDescription>{format(dict.noteCount, { count: note.length, max: NOTE_MAX })}</FieldDescription>
          {errorFor(SCOPE, "note")}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {editing ? dict.update : entry ? dict.saveToday : dict.save}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={onDone}>
              {dict.cancelEdit}
            </Button>
          )}
        </div>
        {feedbackFor(SCOPE)}
      </FieldGroup>
    </form>
  )
}

// Onglet « Journal » de l'espace client : humeur du jour, courbe des 30 derniers jours, entrées récentes.
export function MoodJournal({ dict, portal }: { dict: MoodDict; portal: Portal }) {
  const label = useDayLabel()
  const { data, act, busy } = portal
  const entries = data?.mood ?? []
  const todayEntry = entries.find((entry) => entry.day === today())
  const [editing, setEditing] = useState<MoodEntry | null>(null)
  const [deleting, setDeleting] = useState<MoodEntry | null>(null)
  const formCard = useRef<HTMLDivElement>(null)
  const current = editing ?? todayEntry

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card className="h-fit scroll-mt-24" ref={formCard}>
        <CardHeader>
          <CardTitle className="text-2xl">{dict.title}</CardTitle>
          <CardDescription>{dict.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* La clé recrée le formulaire avec les valeurs de l'entrée choisie ou enregistrée. */}
          <MoodForm
            key={`${editing ? "edit" : "today"}-${current?.id ?? "new"}-${current?.updatedAt ?? 0}`}
            entry={current}
            editing={!!editing}
            dict={dict}
            portal={portal}
            onDone={() => setEditing(null)}
          />
          <p className="flex gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <ShieldCheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {dict.privacy}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{format(dict.chartTitle, { days: 30 })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <MoodChart entries={entries} days={30} dict={dict} />
          <div className="space-y-3">
            <h3 className="font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase">{dict.recentTitle}</h3>
            {!entries.length ? (
              <p className="text-muted-foreground">{dict.empty}</p>
            ) : (
              <ul className="divide-y">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 gap-3">
                      <MoodIcon mood={entry.mood} className="mt-0.5 size-5 shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">
                          <span>{label(entry.day, true)}</span>
                          <span className="font-normal text-muted-foreground"> · {dict.levels[entry.mood - 1]}</span>
                        </p>
                        <p
                          className={cn(
                            "text-sm break-words whitespace-pre-line",
                            !entry.note && "text-muted-foreground italic",
                          )}
                        >
                          {entry.note ?? dict.noNote}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={format(dict.editLabel, { date: label(entry.day, true) })}
                        title={dict.edit}
                        onClick={() => {
                          portal.setMessage(null)
                          setEditing(entry)
                          formCard.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={format(dict.deleteLabel, { date: label(entry.day, true) })}
                        title={dict.delete}
                        onClick={() => setDeleting(entry)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && format(dict.deleteText, { date: label(deleting.day, true) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!deleting) return
                const target = deleting
                setDeleting(null)
                if (editing?.id === target.id) setEditing(null)
                await act({ action: "delete-mood", id: target.id }, { scope: SCOPE, success: () => dict.deleted })
              }}
            >
              {dict.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Aperçu du gérant : courbe des 14 derniers jours et dernières notes d'un client.
export function MoodSummary({ entries, dict }: { entries: MoodEntry[]; dict: MoodDict }) {
  const label = useDayLabel()
  const notes = entries.filter((entry) => entry.note).slice(0, 3)
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <NotebookPenIcon aria-hidden className="size-4" />
          {dict.adminTitle}
        </h3>
        <p className="text-xs text-muted-foreground">{dict.adminPrivate}</p>
      </div>
      {!entries.length ? (
        <p className="text-sm text-muted-foreground">{dict.adminEmpty}</p>
      ) : (
        <>
          <MoodChart entries={entries} days={14} dict={dict} compact />
          {!!notes.length && (
            <ul className="space-y-2">
              {notes.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-muted p-3 text-sm">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <MoodIcon mood={entry.mood} className="size-4" />
                    <span>
                      {label(entry.day, true)} · {dict.levels[entry.mood - 1]}
                    </span>
                  </p>
                  <p className="mt-1 break-words whitespace-pre-line">{entry.note}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// Encart du panneau d'un rendez-vous : journal du compte client lié (rien pour un prospect).
export function ClientMoodSummary({ userId, dict, portal }: { userId?: number | null; dict: MoodDict; portal: Portal }) {
  if (!userId) return null
  const entries = (portal.data?.mood ?? []).filter((entry) => entry.userId === userId)
  return <MoodSummary entries={entries} dict={dict} />
}

// Carte « Comptes clients » : le même aperçu, dans une fenêtre.
export function ClientMoodDialog({ client, dict, portal }: { client: Client; dict: MoodDict; portal: Portal }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <NotebookPenIcon data-icon="inline-start" />
        {dict.adminOpen}
      </DialogTrigger>
      <DialogContent closeLabel={dict.close}className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{format(dict.adminDialogTitle, { name: client.name })}</DialogTitle>
          <DialogDescription>{client.email}</DialogDescription>
        </DialogHeader>
        <ClientMoodSummary userId={client.id} dict={dict} portal={portal} />
      </DialogContent>
    </Dialog>
  )
}
