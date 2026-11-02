"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, type FocusEvent, type FormEvent } from "react"
import { CircleAlertIcon, CircleCheckIcon, DownloadIcon, LogOutIcon } from "lucide-react"

import { BookingForm, type BookingFormProps } from "@/components/booking/booking-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"
import { format, formatDateTime } from "@/lib/format"

type Client = { id: number; name: string; email: string; phone: string | null; active: boolean }
type Data = {
  user: { name: string; role: "admin" | "client"; phone: string | null } | null
  appointments?: {
    id: number
    type: keyof Texts["types"]
    format: keyof Texts["formats"]
    name: string
    email: string
    phone?: string
    intention?: string
    completed: boolean
    past: boolean
    starts: number
  }[]
  documents?: { id: number; title: string; user_id: number | null }[]
  clients?: Client[]
  slots?: { id: number; starts: number; ends: number; appointment_id: number | null }[]
}

type ClientAreaProps = {
  dict: Texts["portal"]
  bookingDict: BookingFormProps["dict"]
  types: Texts["types"]
  formats: Texts["formats"]
  networkError: string
}

const ALL_CLIENTS = "all"

// Empêche de choisir une date passée dans le sélecteur du navigateur (heure locale de l'appareil).
function limitToFuture(event: FocusEvent<HTMLInputElement>) {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  event.currentTarget.min = now.toISOString().slice(0, 16)
}

type Scope = "login" | "register" | "appointments" | "documents" | "slots" | "clients"

export function ClientArea({ dict, bookingDict, types, formats, networkError }: ClientAreaProps) {
  const [data, setData] = useState<Data | null>(null)
  // `scope` : carte où afficher le message (à côté du formulaire utilisé) ; absent = haut de page.
  // `field` : champ fautif renvoyé par l'API ; l'erreur s'affiche alors sous ce champ.
  const [message, setMessage] = useState<{ ok: boolean; text: string; scope?: Scope; field?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<Data> => {
    const response = await fetch("/api/portal", { cache: "no-store" })
    if (!response.ok) throw new Error(networkError)
    return response.json()
  }, [networkError])

  async function refresh() {
    setData(await load())
  }

  useEffect(() => {
    let active = true
    load()
      .then((result) => active && setData(result))
      .catch((error: Error) => active && setMessage({ ok: false, text: error.message }))
    return () => {
      active = false
    }
  }, [load])

  type Options = { success?: (result: Record<string, number>) => string; scope?: Scope }

  async function act(payload: Record<string, unknown> | FormData, { success, scope }: Options = {}) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/portal", {
        method: "POST",
        ...(payload instanceof FormData
          ? { body: payload }
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      })
      const result = await response.json()
      if (!response.ok) {
        setMessage({ ok: false, text: result.error, scope, field: result.field })
        return false
      }
      await refresh()
      setMessage({ ok: true, text: success ? success(result) : dict.saved, scope })
      return true
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : networkError, scope })
      return false
    } finally {
      setBusy(false)
    }
  }

  function submit(action: string, transform?: (fields: FormData) => Record<string, unknown>, options?: Options) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const fields = new FormData(form)
      if (await act({ action, ...(transform ? transform(fields) : Object.fromEntries(fields)) }, options)) form.reset()
    }
  }

  // Message général de la carte, sauf si l'erreur concerne un champ précis.
  const feedbackFor = (scope?: Scope) =>
    message &&
    message.scope === scope &&
    !message.field && (
      <Alert variant={message.ok ? "default" : "destructive"} role="status">
        {message.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
        <AlertDescription>{message.text}</AlertDescription>
      </Alert>
    )
  const feedback = feedbackFor()

  const isInvalid = (scope: Scope, field: string) =>
    !!message && !message.ok && message.scope === scope && message.field === field
  const errorFor = (scope: Scope, field: string) => isInvalid(scope, field) && <FieldError>{message?.text}</FieldError>

  if (!data)
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-16 sm:px-6">
        {message ? (
          <>
            {feedback}
            <Button onClick={() => refresh().catch((error: Error) => setMessage({ ok: false, text: error.message }))}>
              {dict.retry}
            </Button>
          </>
        ) : (
          <>
            <p className="sr-only" role="status">
              {dict.loading}
            </p>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </div>
    )

  if (!data.user)
    return (
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="secondary">{dict.loginEyebrow}</Badge>
          <h1 className="text-5xl font-semibold">{dict.loginTitle}</h1>
          <p className="text-lg text-muted-foreground">{dict.loginIntro}</p>
          <p className="text-muted-foreground">{dict.loginNote}</p>
          <Button variant="outline" render={<Link href="/rendez-vous" />} nativeButton={false}>
            {dict.loginBookLink}
          </Button>
        </div>
        <Tabs defaultValue="login" onValueChange={() => setMessage(null)}>
          <TabsList className="w-full">
            <TabsTrigger value="login">{dict.loginTab}</TabsTrigger>
            <TabsTrigger value="register">{dict.registerTab}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">{dict.loginTitleForm}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit("login", undefined, { scope: "login" })}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="login-email" data-invalid={isInvalid("login", "email")}>
                        {dict.email}
                      </FieldLabel>
                      <Input
                        id="login-email"
                        aria-invalid={isInvalid("login", "email")}
                        name="email"
                        type="email"
                        autoComplete="username"
                        required
                        maxLength={254}
                      />
                      {errorFor("login", "email")}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-password" data-invalid={isInvalid("login", "password")}>
                        {dict.password}
                      </FieldLabel>
                      <Input
                        id="login-password"
                        aria-invalid={isInvalid("login", "password")}
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={256}
                      />
                      {errorFor("login", "password")}
                    </Field>
                    <Button type="submit" size="lg" className="h-11" disabled={busy}>
                      {busy ? dict.loggingIn : dict.login}
                    </Button>
                    {feedbackFor("login")}
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">{dict.registerTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={submit(
                    "register",
                    (fields) => ({ ...Object.fromEntries(fields), consent: fields.get("consent") === "on" }),
                    { scope: "register" },
                  )}
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="register-name" data-invalid={isInvalid("register", "name")}>
                        {dict.registerName}
                      </FieldLabel>
                      <Input
                        id="register-name"
                        aria-invalid={isInvalid("register", "name")}
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={160}
                      />
                      {errorFor("register", "name")}
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="register-email" data-invalid={isInvalid("register", "email")}>
                          {dict.email}
                        </FieldLabel>
                        <Input
                          id="register-email"
                          aria-invalid={isInvalid("register", "email")}
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                        />
                        {errorFor("register", "email")}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="register-phone" data-invalid={isInvalid("register", "phone")}>
                          {dict.registerPhone}
                        </FieldLabel>
                        <Input
                          id="register-phone"
                          aria-invalid={isInvalid("register", "phone")}
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          required
                          maxLength={30}
                        />
                        {errorFor("register", "phone")}
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="register-password" data-invalid={isInvalid("register", "password")}>
                        {dict.registerPassword}
                      </FieldLabel>
                      <Input
                        id="register-password"
                        aria-invalid={isInvalid("register", "password")}
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={256}
                      />
                      {errorFor("register", "password")}
                    </Field>
                    <Field orientation="horizontal" data-invalid={isInvalid("register", "consent")}>
                      <Checkbox
                        id="register-consent"
                        name="consent"
                        required
                        aria-invalid={isInvalid("register", "consent")}
                      />
                      <FieldLabel htmlFor="register-consent" className="font-normal">
                        <span>
                          {dict.registerConsent}{" "}
                          <Link href="/confidentialite" className="underline underline-offset-4">
                            {dict.registerConsentLink}
                          </Link>
                          .
                        </span>
                      </FieldLabel>
                    </Field>
                    {errorFor("register", "consent")}
                    <Button type="submit" size="lg" className="h-11" disabled={busy}>
                      {busy ? dict.registering : dict.register}
                    </Button>
                    {feedbackFor("register")}
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    )

  const admin = data.user.role === "admin"
  const clientName = (id: number | null) =>
    id ? data.clients?.find((client) => client.id === id)?.name : dict.allClients

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="secondary">{admin ? dict.adminEyebrow : dict.clientEyebrow}</Badge>
          <h1 className="text-5xl font-semibold">{format(dict.hello, { name: data.user.name })}</h1>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => act({ action: "logout" })}>
          <LogOutIcon data-icon="inline-start" />
          {dict.logout}
        </Button>
      </div>
      {feedback}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{admin ? dict.appointmentsAdmin : dict.appointmentsClient}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackFor("appointments")}
          {!data.appointments?.length ? (
            <p className="text-muted-foreground">{dict.noAppointments}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.colDate}</TableHead>
                  <TableHead>{dict.colType}</TableHead>
                  {admin && <TableHead>{dict.colContact}</TableHead>}
                  {admin && <TableHead>{dict.colIntention}</TableHead>}
                  <TableHead>{dict.colStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.appointments.map((item) => (
                  <TableRow key={item.id} className="align-top">
                    <TableCell className="whitespace-normal">{formatDateTime(item.starts)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {types[item.type]}
                      <span className="block text-muted-foreground">{formats[item.format]}</span>
                    </TableCell>
                    {admin && (
                      <TableCell className="whitespace-normal">
                        {item.name}
                        <span className="block text-muted-foreground">{item.email}</span>
                        <span className="block text-muted-foreground">{item.phone}</span>
                      </TableCell>
                    )}
                    {admin && <TableCell className="max-w-xs whitespace-normal">{item.intention}</TableCell>}
                    <TableCell className="space-y-2 whitespace-normal">
                      <Badge variant={item.completed ? "default" : "secondary"}>
                        {item.completed ? dict.statusDone : dict.statusConfirmed}
                      </Badge>
                      {admin && item.past && (
                        <Button
                          size="sm"
                          variant="link"
                          disabled={busy}
                          onClick={() => act({ action: "complete", id: item.id }, { scope: "appointments" })}
                        >
                          {item.completed ? dict.unmarkDone : dict.markDone}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!admin && (
        <section className="space-y-4">
          <h2 className="text-3xl font-semibold">{dict.bookTitle}</h2>
          <BookingForm
            dict={bookingDict}
            client
            defaultPhone={data.user.phone ?? undefined}
            onBooked={() => refresh().catch((error: Error) => setMessage({ ok: false, text: error.message }))}
          />
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{admin ? dict.documentsAdmin : dict.documentsClient}</CardTitle>
          <CardDescription>{dict.documentsIntro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {feedbackFor("documents")}
          {!data.documents?.length ? (
            <p className="text-muted-foreground">{dict.noDocuments}</p>
          ) : (
            <ul className="divide-y">
              {data.documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Button
                    variant="link"
                    className="px-0"
                    render={<a href={`/api/portal?action=document&id=${document.id}`} />}
                    nativeButton={false}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    {document.title}
                  </Button>
                  {admin && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{clientName(document.user_id)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act({ action: "remove-document", id: document.id }, { scope: "documents" })}
                      >
                        {dict.remove}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {admin && (
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                const form = event.currentTarget
                const fields = new FormData(form)
                if (fields.get("user_id") === ALL_CLIENTS) fields.delete("user_id")
                if (await act(fields, { scope: "documents" })) form.reset()
              }}
            >
              <FieldGroup>
                <h3 className="text-xl font-semibold">{dict.shareTitle}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="doc-title" data-invalid={isInvalid("documents", "title")}>
                      {dict.docTitle}
                    </FieldLabel>
                    <Input
                      id="doc-title"
                      aria-invalid={isInvalid("documents", "title")}
                      name="title"
                      required
                      maxLength={160}
                    />
                    {errorFor("documents", "title")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="doc-recipient">{dict.recipient}</FieldLabel>
                    <Select
                      name="user_id"
                      defaultValue={ALL_CLIENTS}
                      items={[
                        { value: ALL_CLIENTS, label: dict.allClients },
                        ...(data.clients ?? []).map((client) => ({ value: String(client.id), label: client.name })),
                      ]}
                    >
                      <SelectTrigger id="doc-recipient" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_CLIENTS}>{dict.allClients}</SelectItem>
                        {data.clients?.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="doc-file" data-invalid={isInvalid("documents", "file")}>
                    {dict.pdf}
                  </FieldLabel>
                  <Input
                    id="doc-file"
                    aria-invalid={isInvalid("documents", "file")}
                    name="file"
                    type="file"
                    accept="application/pdf"
                    required
                  />
                  {errorFor("documents", "file")}
                </Field>
                <Button type="submit" className="w-fit" disabled={busy}>
                  {dict.share}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>

      {admin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{dict.slotsTitle}</CardTitle>
              <CardDescription>{dict.slotsIntro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                onSubmit={submit(
                  "add-slot",
                  (fields) => ({
                    starts: new Date(String(fields.get("starts"))).getTime(),
                    ends: new Date(String(fields.get("ends"))).getTime(),
                    minutes: Number(fields.get("minutes")),
                  }),
                  {
                    scope: "slots",
                    success: ({ added, skipped }) =>
                      [format(dict.slotsAdded, { added }), skipped ? format(dict.slotsSkipped, { skipped }) : ""]
                        .filter(Boolean)
                        .join(" "),
                  },
                )}
              >
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="slot-starts" data-invalid={isInvalid("slots", "starts")}>
                        {dict.start}
                      </FieldLabel>
                      <Input
                        id="slot-starts"
                        aria-invalid={isInvalid("slots", "starts")}
                        name="starts"
                        type="datetime-local"
                        required
                        onFocus={limitToFuture}
                      />
                      {errorFor("slots", "starts")}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="slot-ends" data-invalid={isInvalid("slots", "ends")}>
                        {dict.end}
                      </FieldLabel>
                      <Input
                        id="slot-ends"
                        aria-invalid={isInvalid("slots", "ends")}
                        name="ends"
                        type="datetime-local"
                        required
                        onFocus={limitToFuture}
                      />
                      {errorFor("slots", "ends")}
                    </Field>
                  </div>
                  <FieldSet>
                    <FieldLegend variant="label">{dict.slotLength}</FieldLegend>
                    <RadioGroup name="minutes" defaultValue="60" className="flex flex-wrap gap-6">
                      {(["60", "45"] as const).map((minutes) => (
                        <Field key={minutes} orientation="horizontal" className="w-auto">
                          <RadioGroupItem value={minutes} id={`slot-length-${minutes}`} />
                          <FieldLabel htmlFor={`slot-length-${minutes}`} className="font-normal">
                            {minutes === "60" ? dict.slotLength60 : dict.slotLength45}
                          </FieldLabel>
                        </Field>
                      ))}
                    </RadioGroup>
                  </FieldSet>
                  <Button type="submit" className="w-fit" disabled={busy}>
                    {dict.addSlot}
                  </Button>
                  {feedbackFor("slots")}
                </FieldGroup>
              </form>
              {!data.slots?.length ? (
                <p className="text-muted-foreground">{dict.noSlots}</p>
              ) : (
                <ul className="divide-y">
                  {data.slots.map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <span>
                        {formatDateTime(slot.starts)} · {Math.round((slot.ends - slot.starts) / 60000)} min
                      </span>
                      {slot.appointment_id ? (
                        <Badge variant="secondary">{dict.booked}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => act({ action: "remove-slot", id: slot.id }, { scope: "slots" })}
                        >
                          {dict.remove}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{dict.clientsTitle}</CardTitle>
              <CardDescription>{dict.clientsIntro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbackFor("clients")}
              {!data.clients?.length && <p className="text-muted-foreground">{dict.noClients}</p>}
              <ul className="divide-y">
                {data.clients?.map((client) => (
                  <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span>
                      {client.name}
                      <span className="block text-sm text-muted-foreground">
                        {client.email}
                        {client.phone && ` · ${client.phone}`}
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge variant={client.active ? "default" : "outline"}>
                        {client.active ? dict.active : dict.disabled}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => act({ action: "toggle-client", id: client.id }, { scope: "clients" })}
                      >
                        {client.active ? dict.disable : dict.enable}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
