"use client"

import { useState } from "react"
import { CalendarPlusIcon, ClockIcon, DownloadIcon, KeyRoundIcon, LockIcon, LogOutIcon } from "lucide-react"

import { BookingForm, type BookingFormProps } from "@/components/booking/booking-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"
import { format, formatDateTime } from "@/lib/format"

import { AppointmentActions } from "./appointment-actions"
import type { Appointment, Portal } from "./use-portal"

type ClientDashboardProps = {
  dict: Texts["portal"]
  bookingDict: BookingFormProps["dict"]
  types: Texts["types"]
  formats: Texts["formats"]
  portal: Portal
}

type Section = "appointments" | "book" | "documents" | "profile"
type Filter = "upcoming" | "past" | "cancelled"

// Espace client : prochain rendez-vous, gestion des rendez-vous, réservation, documents et profil.
export function ClientDashboard({ dict, bookingDict, types, formats, portal }: ClientDashboardProps) {
  const { data, busy, act, submit, feedbackFor, isInvalid, errorFor, refresh, setMessage } = portal
  const [section, setSection] = useState<Section>("appointments")
  const [filter, setFilter] = useState<Filter>("upcoming")
  if (!data?.user) return null
  const user = data.user
  const text = dict.client

  const all = data.appointments ?? []
  const lists: Record<Filter, Appointment[]> = {
    upcoming: all
      .filter((item) => item.status === "confirmed" && !item.past)
      .sort((a, b) => a.starts - b.starts),
    past: all.filter((item) => item.status === "confirmed" && item.past),
    cancelled: all.filter((item) => item.status === "cancelled"),
  }
  const next = lists.upcoming[0]
  const empty: Record<Filter, string> = {
    upcoming: text.emptyUpcoming,
    past: text.emptyPast,
    cancelled: text.emptyCancelled,
  }
  const actionProps = { dict: text, types, loadingLabel: bookingDict.form.loading, portal }

  const statusOf = (item: Appointment) => {
    if (item.status === "cancelled") return <Badge variant="outline">{dict.statusCancelled}</Badge>
    if (!item.past) return <Badge variant="secondary">{dict.statusConfirmed}</Badge>
    return <Badge variant={item.completed ? "default" : "outline"}>{item.completed ? dict.statusDone : dict.statusPast}</Badge>
  }
  // Parcours : les documents se débloquent selon le nombre de séances réalisées.
  const documents = data.documents ?? []
  const done = data.completedSessions ?? 0
  const goal = Math.max(0, ...documents.map((document) => document.required_sessions))
  const nextUnlock = documents.find((document) => !document.unlocked)?.required_sessions

  const duration = (item: Appointment) => `${Math.round((item.ends - item.starts) / 60000)} ${bookingDict.minutes}`

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="secondary">{dict.clientEyebrow}</Badge>
          <h1 className="text-5xl font-semibold">{format(dict.hello, { name: user.name })}</h1>
          <p className="text-lg text-muted-foreground">{text.intro}</p>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => act({ action: "logout" })}>
          <LogOutIcon data-icon="inline-start" />
          {dict.logout}
        </Button>
      </div>
      {feedbackFor()}
      {user.passwordTemporary && (
        <Alert>
          <KeyRoundIcon />
          <AlertTitle>{text.temporaryTitle}</AlertTitle>
          <AlertDescription>
            <p>{text.temporaryText}</p>
            {section !== "profile" && (
              <Button size="sm" onClick={() => setSection("profile")}>
                {text.temporaryCta}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-primary text-primary-foreground ring-0">
        <CardHeader>
          <CardDescription className="text-xs font-medium tracking-widest text-primary-foreground/75 uppercase">
            {text.nextTitle}
          </CardDescription>
          {next ? (
            <CardTitle className="font-heading text-3xl first-letter:uppercase">{formatDateTime(next.starts)}</CardTitle>
          ) : (
            <CardTitle className="font-heading text-3xl">{text.nextEmpty}</CardTitle>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          {next ? (
            <>
              <p className="flex items-center gap-2 text-primary-foreground/85">
                <ClockIcon className="size-4" />
                {types[next.type]} · {duration(next)} · {formats[next.format]}
              </p>
              {next.changeable ? (
                <AppointmentActions appointment={next} {...actionProps} inverted />
              ) : (
                <p className="text-sm text-primary-foreground/75">{text.tooLate}</p>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={() => setSection("book")}>
              <CalendarPlusIcon data-icon="inline-start" />
              {text.nextEmptyCta}
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs
        value={section}
        onValueChange={(value) => {
          setSection(value as Section)
          setMessage(null)
        }}
      >
        {/* Sur mobile, les onglets défilent horizontalement plutôt que de déborder. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="appointments">{text.tabAppointments}</TabsTrigger>
            <TabsTrigger value="book">{text.tabBook}</TabsTrigger>
            <TabsTrigger value="documents">{text.tabDocuments}</TabsTrigger>
            <TabsTrigger value="profile">{text.tabProfile}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="appointments" className="pt-4">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-2xl">{dict.appointmentsClient}</CardTitle>
                <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
                  <TabsList>
                    {(["upcoming", "past", "cancelled"] as const).map((key) => (
                      <TabsTrigger key={key} value={key}>
                        {key === "upcoming" ? text.filterUpcoming : key === "past" ? text.filterPast : text.filterCancelled}
                        <span className="text-muted-foreground tabular-nums">{lists[key].length}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <CardDescription>{text.changeNotice}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedbackFor("appointments")}
              {!lists[filter].length ? (
                <p className="text-muted-foreground">{empty[filter]}</p>
              ) : (
                <ul className="divide-y">
                  {lists[filter].map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium first-letter:uppercase">{formatDateTime(item.starts)}</p>
                        <p className="text-sm text-muted-foreground">
                          {types[item.type]} · {duration(item)} · {formats[item.format]}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {statusOf(item)}
                        <AppointmentActions appointment={item} {...actionProps} />
                        {filter === "upcoming" && !item.changeable && (
                          <span className="text-sm text-muted-foreground">{text.tooLate}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="book" className="pt-4">
          <BookingForm
            dict={bookingDict}
            client
            defaultPhone={user.phone ?? undefined}
            onBooked={() => refresh().catch((error: Error) => setMessage({ ok: false, text: error.message }))}
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{dict.documentsClient}</CardTitle>
              <CardDescription>{dict.documentsIntro}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{text.journeyTitle}</p>
                {goal > 0 ? (
                  <Progress value={Math.min(done, goal)} max={goal}>
                    <ProgressLabel>{format(text.journeyDone, { count: done })}</ProgressLabel>
                    <ProgressValue>{(_, value) => `${value} / ${goal}`}</ProgressValue>
                  </Progress>
                ) : (
                  <p className="text-sm font-medium">{format(text.journeyDone, { count: done })}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {nextUnlock !== undefined
                    ? format(text.journeyNext, { count: nextUnlock })
                    : goal > 0
                      ? text.journeyComplete
                      : text.journeyEmpty}
                </p>
              </div>
              {!documents.length ? (
                <p className="text-muted-foreground">{dict.noDocuments}</p>
              ) : (
                <ul className="divide-y">
                  {documents.map((document) =>
                    document.unlocked ? (
                      <li key={document.id} className="py-3">
                        <Button
                          variant="link"
                          className="px-0"
                          render={<a href={`/api/portal?action=document&id=${document.id}`} />}
                          nativeButton={false}
                        >
                          <DownloadIcon data-icon="inline-start" />
                          {document.title}
                        </Button>
                      </li>
                    ) : (
                      <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <LockIcon className="size-4" aria-label={text.documentLockedLabel} />
                          {document.title}
                        </p>
                        <Badge variant="outline">{format(text.documentLocked, { count: document.required_sessions })}</Badge>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="grid gap-6 pt-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{text.profileTitle}</CardTitle>
              <CardDescription>{text.profileIntro}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* La clé recrée le formulaire avec les valeurs enregistrées après chaque mise à jour. */}
              <form
                key={`${user.name}|${user.phone}`}
                onSubmit={submit("update-profile", undefined, {
                  scope: "profile",
                  keep: true,
                  success: () => text.profileSaved,
                })}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="profile-name" data-invalid={isInvalid("profile", "name")}>
                      {dict.fullName}
                    </FieldLabel>
                    <Input
                      id="profile-name"
                      aria-invalid={isInvalid("profile", "name")}
                      name="name"
                      autoComplete="name"
                      required
                      maxLength={160}
                      defaultValue={user.name}
                    />
                    {errorFor("profile", "name")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="profile-phone" data-invalid={isInvalid("profile", "phone")}>
                      {dict.phone}
                    </FieldLabel>
                    <Input
                      id="profile-phone"
                      aria-invalid={isInvalid("profile", "phone")}
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      defaultValue={user.phone ?? ""}
                    />
                    {errorFor("profile", "phone")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="profile-email">{dict.email}</FieldLabel>
                    <Input id="profile-email" type="email" value={user.email} readOnly disabled />
                    <FieldDescription>{text.emailHint}</FieldDescription>
                  </Field>
                  <Button type="submit" className="w-fit" disabled={busy}>
                    {text.profileSave}
                  </Button>
                  {feedbackFor("profile")}
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{text.passwordTitle}</CardTitle>
              <CardDescription>{text.passwordIntro}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit("change-password", undefined, { scope: "password", success: () => text.passwordSaved })}>
                <FieldGroup>
                  {/* Identifiant masqué : aide les gestionnaires de mots de passe à associer le compte. */}
                  <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
                  <Field>
                    <FieldLabel htmlFor="current-password" data-invalid={isInvalid("password", "currentPassword")}>
                      {user.passwordTemporary ? text.currentPasswordTemporary : text.currentPassword}
                    </FieldLabel>
                    <Input
                      id="current-password"
                      aria-invalid={isInvalid("password", "currentPassword")}
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={256}
                    />
                    {errorFor("password", "currentPassword")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-password" data-invalid={isInvalid("password", "password")}>
                      {text.newPassword}
                    </FieldLabel>
                    <Input
                      id="new-password"
                      aria-invalid={isInvalid("password", "password")}
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={256}
                    />
                    {errorFor("password", "password")}
                  </Field>
                  <Button type="submit" className="w-fit" disabled={busy}>
                    {text.passwordSave}
                  </Button>
                  {feedbackFor("password")}
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
