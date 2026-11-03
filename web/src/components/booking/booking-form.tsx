"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CircleCheckIcon, CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { siteConfig } from "@/config/site"
import type { Texts } from "@/content/texts"
import { format, formatDateTime } from "@/lib/format"

import { SlotPicker, type Slot } from "./slot-picker"

type AppointmentType = keyof Texts["types"]

export type BookingFormProps = {
  dict: Pick<Texts, "types" | "formats" | "minutes" | "errors"> & { form: Texts["booking"]["form"] }
  // Client connecté : choix entre suivi et audit, sans saisie du nom ni de l'e-mail.
  client?: boolean
  // Téléphone du compte client, prérempli dans le formulaire.
  defaultPhone?: string
  onBooked?: () => void
}

const durations: Record<AppointmentType, number> = { vente: 45, audit: 45, individuelle: 60, suivi: 60 }

export function BookingForm({ dict, client = false, defaultPhone, onBooked }: BookingFormProps) {
  const choices: AppointmentType[] = client ? ["individuelle", "suivi", "audit"] : ["vente", "audit"]
  const [type, setType] = useState<AppointmentType>(choices[0])
  const [meetingFormat, setMeetingFormat] = useState<string>(siteConfig.meetingFormats[0])
  const [slots, setSlots] = useState<Slot[]>([])
  const [slot, setSlot] = useState("")
  const [consent, setConsent] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  // `field` : champ fautif renvoyé par l'API ; l'erreur s'affiche alors sous ce champ.
  const [result, setResult] = useState<{ ok: boolean; message: string; field?: string } | null>(null)
  const isInvalid = (field: string) => !!result && !result.ok && result.field === field
  const errorFor = (field: string) => isInvalid(field) && <FieldError>{result?.message}</FieldError>

  // Les créneaux sont rechargés à chaque changement de type et après chaque réservation.
  const requestKey = `${type}:${revision}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/portal?action=slots&type=${type}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setSlots(data.slots)
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return
        setSlots([])
        setResult({ ok: false, message: error.message || dict.errors.network })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [type, requestKey, dict.errors.network])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve",
          type,
          format: meetingFormat,
          slot: Number(slot),
          firstName: fields.get("firstName"),
          lastName: fields.get("lastName"),
          email: fields.get("email"),
          phone: fields.get("phone"),
          intention: fields.get("intention"),
          consent,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setResult({ ok: false, message: data.error, field: data.field })
        return
      }
      setResult({
        ok: true,
        message: format(dict.form.success, { type: dict.types[type], date: formatDateTime(data.starts) }),
      })
      form.reset()
      setConsent(false)
      onBooked?.()
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : dict.errors.network })
    } finally {
      setSlot("")
      setRevision((value) => value + 1)
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-xs tracking-widest">{dict.form.step}</CardDescription>
        <CardTitle className="text-3xl">{client ? dict.form.clientTitle : dict.form.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">{dict.form.typeLegend}</FieldLegend>
              <RadioGroup
                value={type}
                onValueChange={(value) => {
                  setType(value as AppointmentType)
                  setSlot("")
                  setResult(null)
                }}
                className={client ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}
              >
                {choices.map((choice) => (
                  <FieldLabel key={choice} htmlFor={`type-${choice}`}>
                    <Field orientation="horizontal">
                      <RadioGroupItem value={choice} id={`type-${choice}`} />
                      <FieldContent>
                        <FieldTitle>{dict.types[choice]}</FieldTitle>
                        <FieldDescription>
                          {durations[choice]} {dict.minutes}
                          {choice === "suivi" && "*"}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">{dict.form.formatLegend}</FieldLegend>
              {siteConfig.meetingFormats.length > 1 ? (
                <RadioGroup value={meetingFormat} onValueChange={(value) => setMeetingFormat(String(value))}>
                  {siteConfig.meetingFormats.map((item) => (
                    <Field key={item} orientation="horizontal">
                      <RadioGroupItem value={item} id={`format-${item}`} />
                      <FieldLabel htmlFor={`format-${item}`} className="font-normal">
                        {dict.formats[item]}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              ) : (
                <FieldDescription>{dict.form.formatOnly}</FieldDescription>
              )}
              {errorFor("format")}
            </FieldSet>

            <FieldSet>
              <FieldLegend variant="label">{dict.form.slotLegend}</FieldLegend>
              <SlotPicker
                slots={slots}
                value={slot}
                onChange={(value) => {
                  setSlot(value)
                  setResult(null)
                }}
                loading={loading}
                loadingLabel={dict.form.loading}
                emptyLabel={dict.form.noSlots}
              />
              {errorFor("slot")}
            </FieldSet>

            {!client && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="firstName" data-invalid={isInvalid("firstName")}>
                    {dict.form.firstName}
                  </FieldLabel>
                  <Input
                    id="firstName"
                    aria-invalid={isInvalid("firstName")}
                    name="firstName"
                    required
                    maxLength={80}
                    autoComplete="given-name"
                  />
                  {errorFor("firstName")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="lastName" data-invalid={isInvalid("lastName")}>
                    {dict.form.lastName}
                  </FieldLabel>
                  <Input
                    id="lastName"
                    aria-invalid={isInvalid("lastName")}
                    name="lastName"
                    required
                    maxLength={80}
                    autoComplete="family-name"
                  />
                  {errorFor("lastName")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="email" data-invalid={isInvalid("email")}>
                    {dict.form.email}
                  </FieldLabel>
                  <Input
                    id="email"
                    aria-invalid={isInvalid("email")}
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                  />
                  {errorFor("email")}
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone" data-invalid={isInvalid("phone")}>
                    {dict.form.phone}
                  </FieldLabel>
                  <Input
                    id="phone"
                    aria-invalid={isInvalid("phone")}
                    name="phone"
                    type="tel"
                    required
                    maxLength={30}
                    autoComplete="tel"
                  />
                  {errorFor("phone")}
                </Field>
              </div>
            )}
            {client && (
              <Field>
                <FieldLabel htmlFor="phone" data-invalid={isInvalid("phone")}>
                  {dict.form.phone}
                </FieldLabel>
                <Input
                  id="phone"
                  aria-invalid={isInvalid("phone")}
                  name="phone"
                  type="tel"
                  required
                  maxLength={30}
                  autoComplete="tel"
                  defaultValue={defaultPhone}
                />
                {errorFor("phone")}
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="intention" data-invalid={isInvalid("intention")}>
                {dict.form.intention}
              </FieldLabel>
              <Textarea
                id="intention"
                aria-invalid={isInvalid("intention")}
                name="intention"
                required
                maxLength={1000}
                rows={4}
              />
              <FieldDescription>{dict.form.intentionHint}</FieldDescription>
              {errorFor("intention")}
            </Field>

            <Field orientation="horizontal">
              <Checkbox id="consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
              <FieldLabel htmlFor="consent" className="font-normal">
                <span>
                  {dict.form.consentBefore}{" "}
                  <Link href="/confidentialite" className="underline underline-offset-4">
                    {dict.form.consentLink}
                  </Link>
                  .
                </span>
              </FieldLabel>
            </Field>

            <Button type="submit" size="lg" className="h-11" disabled={busy || loading || !slot || !consent}>
              {busy ? dict.form.submitting : dict.form.submit}
            </Button>

            {result && !result.field && (
              <Alert variant={result.ok ? "default" : "destructive"} role="status">
                {result.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
                {result.ok && <AlertTitle>{dict.form.successTitle}</AlertTitle>}
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            )}
            {client && <FieldDescription>{dict.form.followUpNote}</FieldDescription>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
