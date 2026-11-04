"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, InfoIcon, RotateCcwIcon } from "lucide-react"

import { CrisisResources } from "@/components/sections/crisis-resources"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import type { Texts } from "@/content/texts"
import { saveBookingPrefill } from "@/lib/booking-prefill"
import { format } from "@/lib/format"
import { quizSummary, quizTier } from "@/lib/quiz"

type SelfAssessmentProps = { dict: Texts["quiz"]; crisis: Texts["crisis"] }

// Une question par écran, puis le résultat. Les réponses ne quittent jamais le navigateur,
// sauf si la personne choisit d'en joindre le résumé à sa demande de rendez-vous.
export function SelfAssessment({ dict, crisis }: SelfAssessmentProps) {
  const total = dict.questions.length
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => Array(total).fill(undefined))
  const [step, setStep] = useState(0)
  const [attach, setAttach] = useState(false)
  // Après un changement d'écran, le focus va sur le titre pour que la question soit annoncée.
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    heading.current?.focus()
  }, [step])

  function go(next: number) {
    moved.current = true
    setStep(next)
  }

  function choose(value: number) {
    setAnswers((current) => current.map((answer, index) => (index === step ? value : answer)))
    go(step + 1)
  }

  function restart() {
    setAnswers(Array(total).fill(undefined))
    setAttach(false)
    go(0)
  }

  const done = step >= total
  const complete = answers.every((answer) => answer !== undefined)
  const values = answers.map((answer) => answer ?? 0)

  function book() {
    if (attach && complete) saveBookingPrefill({ type: "vente", intention: quizSummary(dict, values) })
  }

  const progress = (
    <Progress value={done ? 100 : (step / total) * 100}>
      <ProgressLabel className="text-muted-foreground">
        {done ? dict.resultEyebrow : format(dict.progress, { current: step + 1, total })}
      </ProgressLabel>
    </Progress>
  )

  if (!done) {
    const question = dict.questions[step]
    return (
      <Card>
        <CardHeader>{progress}</CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{dict.lead}</p>
            <h2
              ref={heading}
              id="quiz-question"
              tabIndex={-1}
              className="text-2xl font-semibold outline-none md:text-3xl"
            >
              {question.text}
            </h2>
          </div>
          <div role="group" aria-labelledby="quiz-question" className="grid gap-2 sm:grid-cols-2">
            {dict.scale.map((label, value) => (
              <Button
                key={label}
                type="button"
                size="lg"
                variant={answers[step] === value ? "default" : "outline"}
                aria-pressed={answers[step] === value}
                className="h-12 justify-start px-4 text-base"
                onClick={() => choose(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" disabled={step === 0} onClick={() => go(step - 1)}>
              <ArrowLeftIcon data-icon="inline-start" />
              {dict.previous}
            </Button>
            {answers[step] !== undefined && (
              <Button type="button" variant="ghost" onClick={() => go(step + 1)}>
                {dict.next}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const tier = quizTier(values)
  const crisisBox = <CrisisResources dict={crisis} />

  return (
    <Card>
      <CardHeader>{progress}</CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h2 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">
            {dict.tiers[tier].title}
          </h2>
          <p className="text-muted-foreground">{dict.tiers[tier].text}</p>
        </div>
        {/* Palier le plus élevé : les numéros d'urgence passent avant la réservation. */}
        {tier === "high" && crisisBox}
        <Alert role="note">
          <InfoIcon />
          <AlertDescription>{dict.disclaimer}</AlertDescription>
        </Alert>
        <Field orientation="horizontal">
          <Checkbox id="quiz-attach" checked={attach} onCheckedChange={(value) => setAttach(value === true)} />
          <FieldContent>
            <FieldLabel htmlFor="quiz-attach">{dict.attach}</FieldLabel>
            <FieldDescription>{dict.attachHint}</FieldDescription>
          </FieldContent>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="h-11 px-5"
            render={<Link href="/rendez-vous" onClick={book} />}
            nativeButton={false}
          >
            {dict.cta}
          </Button>
          <Button type="button" variant="ghost" onClick={() => go(total - 1)}>
            <ArrowLeftIcon data-icon="inline-start" />
            {dict.previous}
          </Button>
          <Button type="button" variant="ghost" onClick={restart}>
            <RotateCcwIcon data-icon="inline-start" />
            {dict.restart}
          </Button>
        </div>
        {tier !== "high" && crisisBox}
      </CardContent>
    </Card>
  )
}
