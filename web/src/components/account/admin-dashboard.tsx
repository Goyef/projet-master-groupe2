"use client"

import { useEffect, useState, type FocusEvent } from "react"
import {
  BellRingIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  ClockIcon,
  DownloadIcon,
  LifeBuoyIcon,
  LogOutIcon,
} from "lucide-react"

import { useDateFormatter } from "@/components/i18n/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import { AdminAgenda } from "./admin-agenda"
import { AdminAppointments } from "./admin-appointments"
import { AdminCalendar, typeLabel } from "./admin-calendar"
import { AppointmentSheet, CALENDAR_SCOPE } from "./appointment-sheet"
import { parisTime } from "./calendar-dates"
import { ClientAccounts } from "./client-accounts"
import { ShareDocumentForm } from "./share-document-form"
import { SlotSchedule } from "./slot-schedule"
import { AdminSupport } from "./support-tickets"
import type { Portal } from "./use-portal"

// Empêche de choisir une date passée dans le sélecteur du navigateur (heure locale de l'appareil).
function limitToFuture(event: FocusEvent<HTMLInputElement>) {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  event.currentTarget.min = now.toISOString().slice(0, 16)
}

type AdminDashboardProps = {
  dict: Texts["portal"]
  types: Texts["types"]
  formats: Texts["formats"]
  loadingLabel: string
  waitlistDict: Texts["waitlist"]
  portal: Portal
}

type Section = keyof Texts["portal"]["dashboard"]["tabs"]
const SECTIONS: Section[] = ["calendar", "appointments", "slots", "support", "clients", "documents", "sync"]
const WEEK_MS = 7 * 86_400_000

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof ClockIcon; label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <p className="font-heading text-2xl leading-tight font-semibold first-letter:uppercase">{value}</p>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  )
}

// Espace gérant : indicateurs, calendrier des rendez-vous (avec actions), liste, disponibilités,
// support, clients, documents et synchronisation d'agenda, rangés en onglets.
export function AdminDashboard({ dict, types, formats, loadingLabel, waitlistDict, portal }: AdminDashboardProps) {
  const formatDateTime = useDateFormatter()
  const { data, busy, act, submit, feedbackFor, isInvalid, errorFor, setMessage } = portal
  const [section, setSection] = useState<Section>("calendar")
  // Identifiant seulement : le panneau suit les données à jour après chaque action.
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Heure courante pour les indicateurs, rafraîchie chaque minute.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  if (!data?.user) return null
  const text = dict.dashboard
  // Destinataires d'un document : « Tous les clients » ou les noms des clients choisis.
  const recipientNames = (document: { all_clients: boolean; recipients?: number[] }) =>
    document.all_clients
      ? dict.allClients
      : (document.recipients ?? [])
          .map((id) => data.clients?.find((client) => client.id === id)?.name)
          .filter(Boolean)
          .join(", ")

  const appointments = data.appointments ?? []
  const selected = appointments.find((item) => item.id === selectedId) ?? null
  const upcoming = appointments
    .filter((item) => item.status === "confirmed" && item.starts > now)
    .sort((a, b) => a.starts - b.starts)
  const todayKey = parisTime(now).day
  const todayCount = appointments.filter(
    (item) => item.status === "confirmed" && parisTime(item.starts).day === todayKey,
  ).length
  const weekCount = upcoming.filter((item) => item.starts < now + WEEK_MS).length
  const freeSlots = (data.slots ?? []).filter((slot) => !slot.appointment_id)
  const freeThisWeek = freeSlots.filter((slot) => slot.starts < now + WEEK_MS).length
  const openTickets = (data.tickets ?? []).filter((ticket) => ticket.status !== "closed").length
  const next = upcoming[0]
  const waitlist = data.waitlist ?? { vente: 0, audit: 0, suivi: 0 }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Badge variant="secondary">{dict.adminEyebrow}</Badge>
          <h1 className="text-5xl font-semibold">{format(dict.hello, { name: data.user.name })}</h1>
        </div>
        <Button variant="outline" disabled={busy} onClick={() => act({ action: "logout" })}>
          <LogOutIcon data-icon="inline-start" />
          {dict.logout}
        </Button>
      </div>
      {feedbackFor()}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={CalendarDaysIcon} label={text.kpiToday} value={format(text.count, { count: todayCount })} />
        <Kpi
          icon={CalendarRangeIcon}
          label={text.kpiWeek}
          value={format(text.count, { count: weekCount })}
          hint={format(text.kpiFreeSlots, { count: freeThisWeek })}
        />
        <Kpi
          icon={ClockIcon}
          label={text.kpiNext}
          value={next ? formatDateTime(next.starts) : text.kpiNone}
          hint={next ? `${next.name} · ${typeLabel(types, next.type)}` : undefined}
        />
        <Kpi icon={LifeBuoyIcon} label={text.kpiTickets} value={String(openTickets)} />
        <Kpi
          icon={BellRingIcon}
          label={waitlistDict.adminKpi}
          value={String(waitlist.vente + waitlist.audit + waitlist.suivi)}
          hint={format(waitlistDict.adminHint, waitlist)}
        />
      </div>

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
            {SECTIONS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {text.tabs[key]}
                {key === "support" && openTickets > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{openTickets}</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="calendar" className="space-y-4 pt-4">
          {feedbackFor(CALENDAR_SCOPE)}
          <Card>
            <CardContent>
              <AdminCalendar
                appointments={appointments}
                freeSlots={freeSlots}
                dict={text}
                types={types}
                busy={busy}
                onSelect={(item) => setSelectedId(item.id)}
                onRemoveSlot={(id) => act({ action: "remove-slot", id }, { scope: CALENDAR_SCOPE })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4 pt-4">
          {feedbackFor(CALENDAR_SCOPE)}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{dict.appointmentsAdmin}</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminAppointments
                appointments={appointments}
                dict={dict}
                types={types}
                formats={formats}
                onSelect={(item) => setSelectedId(item.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slots" className="pt-4">
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
                <SlotSchedule
                  slots={data.slots}
                  busy={busy}
                  onRemove={(id) => act({ action: "remove-slot", id }, { scope: "slots" })}
                  labels={{ booked: dict.booked, removeSlot: dict.removeSlot, slotCount: dict.slotCount }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="pt-4">
          <AdminSupport dict={dict.support} portal={portal} />
        </TabsContent>

        <TabsContent value="clients" className="pt-4">
          <ClientAccounts dict={dict} portal={portal} />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{dict.documentsAdmin}</CardTitle>
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
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">
                          {document.required_sessions
                            ? format(dict.documentAfter, { count: document.required_sessions })
                            : dict.documentImmediate}
                        </Badge>
                        <span className="max-w-xs truncate text-sm text-muted-foreground" title={recipientNames(document)}>
                          {recipientNames(document)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => act({ action: "remove-document", id: document.id }, { scope: "documents" })}
                        >
                          {dict.remove}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <ShareDocumentForm dict={dict} portal={portal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="pt-4">
          <AdminAgenda
            dict={dict.agenda}
            agenda={data.agenda}
            calendly={{
              email: data.user?.email ?? "",
              // Types d'événements « importés » dans la démo Calendly, repris des rendez-vous Synégo.
              eventTypes: [
                { label: types.vente, minutes: 45, slug: "appel-decouverte" },
                { label: types.audit, minutes: 45, slug: "audit-seminaire" },
                { label: types.suivi, minutes: 60, slug: "seance-de-suivi" },
              ],
              upcoming: (data.appointments ?? []).filter((item) => item.status === "confirmed" && !item.past).length,
            }}
          />
        </TabsContent>
      </Tabs>

      <AppointmentSheet
        key={selected?.id ?? "aucun"}
        appointment={selected}
        onClose={() => setSelectedId(null)}
        dict={dict}
        types={types}
        formats={formats}
        loadingLabel={loadingLabel}
        portal={portal}
      />
    </div>
  )
}
