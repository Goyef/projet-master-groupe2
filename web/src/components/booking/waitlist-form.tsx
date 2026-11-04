"use client"

import Link from "next/link"
import { useState, type KeyboardEvent } from "react"
import { BellRingIcon, CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { useLocalizedFetch } from "@/components/i18n/locale-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Texts } from "@/content/texts"
import { cn } from "@/lib/utils"

type AppointmentType = keyof Texts["types"]

export type WaitlistFormProps = {
  dict: Texts["waitlist"]
  types: Texts["types"]
  networkError: string
  // Type choisi dans le formulaire de réservation : proposé par défaut.
  type: AppointmentType
  // Aucun créneau pour ce type : le formulaire s'affiche d'emblée, mis en avant.
  empty: boolean
  defaultEmail?: string
  // Client connecté : la séance de suivi est aussi proposée.
  client?: boolean
}

// « Prévenez-moi si un créneau se libère ». Placé dans le formulaire de réservation, il n'utilise
// pas d'élément <form> (formulaires imbriqués interdits) : envoi au clic ou avec Entrée.
export function WaitlistForm({ dict, types, networkError, type, empty, defaultEmail, client = false }: WaitlistFormProps) {
  const localizedFetch = useLocalizedFetch()
  const choices: AppointmentType[] = client ? ["vente", "audit", "suivi"] : ["vente", "audit"]
  // Choix propre à la liste d'attente, oublié quand le type de la réservation change.
  const [picked, setPicked] = useState<{ base: AppointmentType; value: AppointmentType } | null>(null)
  const chosen = picked?.base === type ? picked.value : choices.includes(type) ? type : choices[0]
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail ?? "")
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string; field?: string } | null>(null)
  const invalid = (field: string) => !!result && !result.ok && result.field === field
  const errorFor = (field: string) => invalid(field) && <FieldError>{result?.message}</FieldError>

  async function submit() {
    if (busy) return
    setBusy(true)
    setResult(null)
    try {
      const response = await localizedFetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waitlist-subscribe", email, type: chosen, consent }),
      })
      const data = await response.json()
      if (!response.ok) {
        setResult({ ok: false, message: data.error, field: data.field })
        return
      }
      setResult({ ok: true, message: dict.success })
      setConsent(false)
    } catch {
      setResult({ ok: false, message: networkError })
    } finally {
      setBusy(false)
    }
  }

  // Entrée dans le champ e-mail : inscription à la liste, pas envoi de la réservation.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    void submit()
  }

  if (!empty && !open)
    return (
      <Button
        type="button"
        variant="link"
        className="h-auto justify-start p-0 text-left whitespace-normal"
        onClick={() => setOpen(true)}
      >
        <BellRingIcon data-icon="inline-start" />
        {dict.toggle}
      </Button>
    )

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border p-4",
        empty ? "border-brand-sky/60 bg-accent/60" : "bg-muted/30",
      )}
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-medium">
          <BellRingIcon className="size-4 shrink-0 text-brand-sky" aria-hidden />
          {dict.title}
        </p>
        <FieldDescription>{empty ? dict.emptyIntro : dict.intro}</FieldDescription>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={invalid("email")}>
          <FieldLabel htmlFor="waitlist-email">{dict.email}</FieldLabel>
          <Input
            id="waitlist-email"
            type="email"
            maxLength={254}
            autoComplete="email"
            value={email}
            aria-invalid={invalid("email")}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {errorFor("email")}
        </Field>
        <Field>
          <FieldLabel htmlFor="waitlist-type">{dict.typeLabel}</FieldLabel>
          <Select
            value={chosen}
            onValueChange={(value) => setPicked({ base: type, value: value as AppointmentType })}
            items={choices.map((choice) => ({ value: choice, label: types[choice] }))}
          >
            <SelectTrigger id="waitlist-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  {types[choice]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field orientation="horizontal" data-invalid={invalid("consent")}>
        <Checkbox
          id="waitlist-consent"
          checked={consent}
          aria-invalid={invalid("consent")}
          onCheckedChange={(value) => setConsent(value === true)}
        />
        <FieldLabel htmlFor="waitlist-consent" className="font-normal">
          <span>
            {dict.consentBefore}{" "}
            <Link href="/confidentialite" className="underline underline-offset-4">
              {dict.consentLink}
            </Link>
            .
          </span>
        </FieldLabel>
      </Field>
      {errorFor("consent")}
      <Button
        type="button"
        variant={empty ? "default" : "outline"}
        disabled={busy || !consent || !email.trim()}
        onClick={() => void submit()}
      >
        {busy ? dict.submitting : dict.submit}
      </Button>
      {result && !result.field && (
        <Alert variant={result.ok ? "default" : "destructive"} role="status">
          {result.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
          {result.ok && <AlertTitle>{dict.successTitle}</AlertTitle>}
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
