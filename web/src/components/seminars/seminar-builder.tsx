"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, ArrowRightIcon, CalendarCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import { saveBookingPrefill } from "@/lib/booking-prefill"

import { seminarIntention } from "./seminar-prefill"

const GOAL_MAX = 300

type Step = "size" | "topics" | "format" | "goal"
const steps: Step[] = ["size", "topics", "format", "goal"]

type SeminarBuilderProps = {
  dict: Texts["seminars"]["builder"]
  topics: readonly string[]
  cta: string
}

export function SeminarBuilder({ dict, topics, cta }: SeminarBuilderProps) {
  const router = useRouter()
  const id = useId()
  const [stepIndex, setStepIndex] = useState(0)
  const [size, setSize] = useState<number | null>(null)
  const [chosenTopics, setChosenTopics] = useState<number[]>([])
  const [formatIndex, setFormatIndex] = useState<number | null>(null)
  const [goal, setGoal] = useState("")
  const [missing, setMissing] = useState(false)
  // Le focus suit l'étape seulement après une action du visiteur, pas au chargement.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (!moved.current) return
    headingRef.current?.focus()
  }, [stepIndex])

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const headingId = `${id}-step`
  const errorId = `${id}-error`

  function goTo(index: number) {
    moved.current = true
    setMissing(false)
    setStepIndex(index)
  }

  // Les étapes « taille » et « format » sont obligatoires ; les thèmes et l'objectif sont facultatifs.
  function firstMissingStep() {
    if (size === null) return steps.indexOf("size")
    if (formatIndex === null) return steps.indexOf("format")
    return -1
  }

  function next() {
    if ((step === "size" && size === null) || (step === "format" && formatIndex === null)) {
      setMissing(true)
      return
    }
    goTo(stepIndex + 1)
  }

  const sizeLabel = size === null ? dict.notChosen : dict.sizes[size]
  const topicsLabel = chosenTopics.length
    ? [...chosenTopics].sort((a, b) => a - b).map((index) => topics[index]).join(", ")
    : dict.topicsOpen
  const formatLabel = formatIndex === null ? dict.notChosen : dict.formats[formatIndex].title
  const trimmedGoal = goal.trim()

  function book() {
    const missingStep = firstMissingStep()
    if (missingStep !== -1) {
      goTo(missingStep)
      setMissing(true)
      return
    }
    const intention = seminarIntention(dict, {
      size: sizeLabel,
      topics: topicsLabel,
      format: formatLabel,
      goal: trimmedGoal,
    })
    // Rien n'est envoyé au serveur : le récapitulatif attend dans l'onglet jusqu'au formulaire.
    // Sans stockage disponible, la réservation reste possible, simplement sans préremplissage.
    saveBookingPrefill({ type: "audit", intention })
    router.push("/rendez-vous")
  }

  function toggleTopic(index: number, checked: boolean) {
    setChosenTopics((current) =>
      checked ? [...current.filter((item) => item !== index), index] : current.filter((item) => item !== index)
    )
  }

  const titles: Record<Step, string> = {
    size: dict.sizeTitle,
    topics: dict.topicsTitle,
    format: dict.formatTitle,
    goal: dict.goalTitle,
  }
  const progressText = format(dict.progress, { current: stepIndex + 1, total: steps.length })
  const summary: { step: Step; label: string; value: string; empty: boolean }[] = [
    { step: "size", label: dict.summarySize, value: sizeLabel, empty: size === null },
    { step: "topics", label: dict.summaryTopics, value: topicsLabel, empty: chosenTopics.length === 0 },
    { step: "format", label: dict.summaryFormat, value: formatLabel, empty: formatIndex === null },
    { step: "goal", label: dict.summaryGoal, value: trimmedGoal || dict.notChosen, empty: !trimmedGoal },
  ]

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader className="gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {progressText}
          </p>
          <Progress value={((stepIndex + 1) / steps.length) * 100} aria-label={progressText} />
          <h3 ref={headingRef} id={headingId} tabIndex={-1} className="pt-2 text-2xl font-semibold outline-none">
            {titles[step]}
          </h3>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (isLast) book()
              else next()
            }}
            className="space-y-6"
          >
            {step === "size" && (
              <FieldSet>
                <RadioGroup
                  value={size === null ? "" : String(size)}
                  onValueChange={(value) => {
                    setSize(Number(value))
                    setMissing(false)
                  }}
                  aria-labelledby={headingId}
                  aria-invalid={missing || undefined}
                  aria-describedby={missing ? errorId : undefined}
                  className="grid-cols-1 sm:grid-cols-2"
                >
                  {dict.sizes.map((label, index) => (
                    <FieldLabel key={label} htmlFor={`${id}-size-${index}`}>
                      <Field orientation="horizontal">
                        <RadioGroupItem value={String(index)} id={`${id}-size-${index}`} />
                        <FieldTitle>{label}</FieldTitle>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
            )}

            {step === "topics" && (
              <FieldSet aria-labelledby={headingId} aria-describedby={`${id}-topics-hint`}>
                <FieldDescription id={`${id}-topics-hint`}>{dict.topicsHint}</FieldDescription>
                <div className="grid gap-2 sm:grid-cols-2">
                  {topics.map((topic, index) => (
                    <FieldLabel key={topic} htmlFor={`${id}-topic-${index}`}>
                      <Field orientation="horizontal">
                        <Checkbox
                          id={`${id}-topic-${index}`}
                          checked={chosenTopics.includes(index)}
                          onCheckedChange={(checked) => toggleTopic(index, checked === true)}
                        />
                        <FieldTitle>{topic}</FieldTitle>
                      </Field>
                    </FieldLabel>
                  ))}
                </div>
              </FieldSet>
            )}

            {step === "format" && (
              <FieldSet>
                <RadioGroup
                  value={formatIndex === null ? "" : String(formatIndex)}
                  onValueChange={(value) => {
                    setFormatIndex(Number(value))
                    setMissing(false)
                  }}
                  aria-labelledby={headingId}
                  aria-invalid={missing || undefined}
                  aria-describedby={missing ? errorId : undefined}
                >
                  {dict.formats.map((item, index) => (
                    <FieldLabel key={item.title} htmlFor={`${id}-format-${index}`}>
                      <Field orientation="horizontal">
                        <RadioGroupItem value={String(index)} id={`${id}-format-${index}`} />
                        <FieldContent>
                          <FieldTitle>{item.title}</FieldTitle>
                          <FieldDescription>{item.description}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
            )}

            {step === "goal" && (
              <Field>
                <FieldLabel htmlFor={`${id}-goal`}>{dict.goalLabel}</FieldLabel>
                <Textarea
                  id={`${id}-goal`}
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  maxLength={GOAL_MAX}
                  rows={3}
                  aria-describedby={`${id}-goal-hint`}
                />
                <FieldDescription id={`${id}-goal-hint`}>{dict.goalHint}</FieldDescription>
              </Field>
            )}

            {missing && <FieldError id={errorId}>{dict.required}</FieldError>}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => goTo(stepIndex - 1)}
                disabled={stepIndex === 0}
                className={stepIndex === 0 ? "invisible" : undefined}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                {dict.previous}
              </Button>
              {isLast ? (
                <Button type="submit" size="lg" className="h-11 px-5 lg:hidden">
                  <CalendarCheckIcon data-icon="inline-start" />
                  {cta}
                </Button>
              ) : (
                <Button type="submit">
                  {dict.next}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-secondary/40 lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle className="text-2xl">{dict.summaryTitle}</CardTitle>
          <CardDescription>{dict.quoteNote}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {summary.map((row) => (
              <div key={row.step} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{row.label}</dt>
                  <dd className={row.empty ? "text-muted-foreground italic" : "break-words text-foreground"}>
                    {row.value}
                  </dd>
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="shrink-0 px-0"
                  onClick={() => goTo(steps.indexOf(row.step))}
                  aria-label={format(dict.prefillLine, { label: dict.edit, value: row.label })}
                >
                  {dict.edit}
                </Button>
              </div>
            ))}
          </dl>
        </CardContent>
        <CardFooter className="bg-transparent">
          <Button type="button" size="lg" className="h-11 w-full px-5" onClick={book}>
            <CalendarCheckIcon data-icon="inline-start" />
            {cta}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
