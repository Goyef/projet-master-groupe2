"use client"

import { useState } from "react"
import { LifeBuoyIcon, SendIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { Texts } from "@/content/texts"
import { format, formatDateTime } from "@/lib/format"

import type { Portal, Ticket, TicketStatus } from "./use-portal"

type SupportDict = Texts["portal"]["support"]

const STATUS_ORDER: TicketStatus[] = ["open", "in_progress", "closed"]
const statusVariant = { open: "default", in_progress: "secondary", closed: "outline" } as const

function StatusBadge({ status, dict }: { status: TicketStatus; dict: SupportDict }) {
  return <Badge variant={statusVariant[status]}>{dict.statuses[status]}</Badge>
}

// Les demandes non clôturées d'abord, puis les plus récemment mises à jour.
function sorted(tickets: Ticket[]) {
  return [...tickets].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.updatedAt - a.updatedAt,
  )
}

// Message initial du client suivi des réponses du gérant.
function Thread({ ticket, dict }: { ticket: Ticket; dict: SupportDict }) {
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line">{ticket.message}</p>
      {ticket.replies.length ? (
        ticket.replies.map((reply) => (
          <div key={reply.id} className="space-y-1 rounded-lg bg-muted px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {format(dict.replyFrom, { date: formatDateTime(reply.createdAt) })}
            </p>
            <p className="whitespace-pre-line">{reply.message}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{dict.noReply}</p>
      )}
    </div>
  )
}

// Onglet « Support » de l'espace client : dépôt d'une demande et suivi de son traitement.
export function ClientSupport({ dict, portal }: { dict: SupportDict; portal: Portal }) {
  const { data, busy, submit, feedbackFor, isInvalid, errorFor } = portal
  const tickets = sorted(data?.tickets ?? [])
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-2xl">{dict.newTitle}</CardTitle>
          <CardDescription>{dict.clientIntro}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit("create-ticket", undefined, { scope: "support", success: () => dict.created })}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ticket-subject" data-invalid={isInvalid("support", "subject")}>
                  {dict.subject}
                </FieldLabel>
                <Input
                  id="ticket-subject"
                  aria-invalid={isInvalid("support", "subject")}
                  name="subject"
                  required
                  maxLength={160}
                />
                {errorFor("support", "subject")}
              </Field>
              <Field>
                <FieldLabel htmlFor="ticket-message" data-invalid={isInvalid("support", "message")}>
                  {dict.message}
                </FieldLabel>
                <Textarea
                  id="ticket-message"
                  aria-invalid={isInvalid("support", "message")}
                  name="message"
                  required
                  maxLength={4000}
                  className="min-h-32"
                />
                <FieldDescription>{dict.messageHint}</FieldDescription>
                {errorFor("support", "message")}
              </Field>
              <Button type="submit" className="w-fit" disabled={busy}>
                <SendIcon data-icon="inline-start" />
                {busy ? dict.submitting : dict.submit}
              </Button>
              {feedbackFor("support")}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{dict.clientTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {!tickets.length ? (
            <p className="text-muted-foreground">{dict.empty}</p>
          ) : (
            <ul className="divide-y">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground first-letter:uppercase">
                        {ticket.closedAt
                          ? format(dict.closedOn, { date: formatDateTime(ticket.closedAt) })
                          : format(dict.updated, { date: formatDateTime(ticket.updatedAt) })}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} dict={dict} />
                  </div>
                  <Thread ticket={ticket} dict={dict} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Fenêtre de traitement d'une demande : réponse au client et changement de statut.
function HandleDialog({ ticket, dict, portal }: { ticket: Ticket; dict: SupportDict; portal: Portal }) {
  const [open, setOpen] = useState(false)
  const { busy, submit, feedbackFor, isInvalid, errorFor, setMessage } = portal
  const scope = `ticket-${ticket.id}`
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setMessage(null)
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>{dict.handle}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{ticket.subject}</DialogTitle>
          <DialogDescription>
            {format(dict.dialogText, {
              name: ticket.name ?? "",
              email: ticket.email ?? "",
              date: formatDateTime(ticket.createdAt),
            })}
          </DialogDescription>
        </DialogHeader>
        <Thread ticket={ticket} dict={dict} />
        {feedbackFor(scope)}
        {ticket.status !== "closed" && (
          <form onSubmit={submit("reply-ticket", (fields) => ({ id: ticket.id, message: fields.get("message") }), { scope, success: () => dict.replied })}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${scope}-reply`} data-invalid={isInvalid(scope, "message")}>
                  {dict.reply}
                </FieldLabel>
                <Textarea
                  id={`${scope}-reply`}
                  aria-invalid={isInvalid(scope, "message")}
                  name="message"
                  required
                  maxLength={4000}
                />
                <FieldDescription>{dict.replyHint}</FieldDescription>
                {errorFor(scope, "message")}
              </Field>
              <Button type="submit" className="w-fit" disabled={busy}>
                <SendIcon data-icon="inline-start" />
                {dict.sendReply}
              </Button>
            </FieldGroup>
          </form>
        )}
        <Separator />
        {/* La clé réinitialise le choix avec le statut enregistré après chaque mise à jour. */}
        <form
          key={ticket.status}
          onSubmit={submit("ticket-status", (fields) => ({ id: ticket.id, status: fields.get("status") }), {
            scope,
            keep: true,
            success: () => dict.statusSaved,
          })}
          className="flex flex-wrap items-end gap-3"
        >
          <Field className="w-auto min-w-48">
            <FieldLabel htmlFor={`${scope}-status`}>{dict.statusLabel}</FieldLabel>
            <Select
              name="status"
              defaultValue={ticket.status}
              items={STATUS_ORDER.map((status) => ({ value: status, label: dict.statuses[status] }))}
            >
              <SelectTrigger id={`${scope}-status`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((status) => (
                  <SelectItem key={status} value={status}>
                    {dict.statuses[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>
            {dict.saveStatus}
          </Button>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{dict.close}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Carte « Demandes de support » de l'espace gérant.
export function AdminSupport({ dict, portal }: { dict: SupportDict; portal: Portal }) {
  const tickets = sorted(portal.data?.tickets ?? [])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <LifeBuoyIcon className="size-5 text-muted-foreground" />
          {dict.adminTitle}
        </CardTitle>
        <CardDescription>{dict.adminIntro}</CardDescription>
      </CardHeader>
      <CardContent>
        {!tickets.length ? (
          <p className="text-muted-foreground">{dict.adminEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.colDate}</TableHead>
                <TableHead>{dict.colClient}</TableHead>
                <TableHead>{dict.colSubject}</TableHead>
                <TableHead>{dict.colStatus}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="align-top">
                  <TableCell className="whitespace-normal">{formatDateTime(ticket.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal">
                    {ticket.name}
                    <span className="block text-muted-foreground">{ticket.email}</span>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal">{ticket.subject}</TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} dict={dict} />
                  </TableCell>
                  <TableCell className="text-right">
                    <HandleDialog ticket={ticket} dict={dict} portal={portal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
