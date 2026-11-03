"use client"

import { useDateFormatter } from "@/components/i18n/locale-provider"

import type { FocusEvent } from "react"
import { DownloadIcon, LogOutIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import { ClientAccounts } from "./client-accounts"
import { SlotSchedule } from "./slot-schedule"
import { AdminAgenda } from "./admin-agenda"
import { AdminSupport } from "./support-tickets"
import type { Appointment, Portal } from "./use-portal"

const ALL_CLIENTS = "all"

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
  portal: Portal
}

function statusBadge(item: Appointment, dict: Texts["portal"]) {
  if (item.status === "cancelled") return <Badge variant="outline">{dict.statusCancelled}</Badge>
  return (
    <Badge variant={item.completed ? "default" : "secondary"}>
      {item.completed ? dict.statusDone : dict.statusConfirmed}
    </Badge>
  )
}

// Espace gérant : rendez-vous, demandes de support, documents, disponibilités et comptes clients.
export function AdminDashboard({ dict, types, formats, portal }: AdminDashboardProps) {
  const formatDateTime = useDateFormatter()
  const { data, busy, act, submit, feedbackFor, isInvalid, errorFor } = portal
  if (!data?.user) return null
  const clientName = (id: number | null) =>
    id ? data.clients?.find((client) => client.id === id)?.name : dict.allClients

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{dict.appointmentsAdmin}</CardTitle>
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
                  <TableHead>{dict.colContact}</TableHead>
                  <TableHead>{dict.colIntention}</TableHead>
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
                    <TableCell className="whitespace-normal">
                      {item.name}
                      <span className="block text-muted-foreground">{item.email}</span>
                      <span className="block text-muted-foreground">{item.phone}</span>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal">{item.intention}</TableCell>
                    <TableCell className="space-y-2 whitespace-normal">
                      {statusBadge(item, dict)}
                      {item.past && item.status === "confirmed" && (
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

      <AdminSupport dict={dict.support} portal={portal} />

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
                </li>
              ))}
            </ul>
          )}
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <Field>
                  <FieldLabel htmlFor="doc-sessions" data-invalid={isInvalid("documents", "required_sessions")}>
                    {dict.requiredSessions}
                  </FieldLabel>
                  <Input
                    id="doc-sessions"
                    aria-invalid={isInvalid("documents", "required_sessions")}
                    name="required_sessions"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={50}
                    step={1}
                    defaultValue={0}
                    required
                  />
                  <FieldDescription>{dict.requiredSessionsHint}</FieldDescription>
                  {errorFor("documents", "required_sessions")}
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
        </CardContent>
      </Card>

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

      <ClientAccounts dict={dict} portal={portal} />
    </div>
  )
}
