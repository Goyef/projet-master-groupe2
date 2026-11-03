"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon, KeyRoundIcon, UserPlusIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import type { Client, Portal } from "./use-portal"

type Credentials = { email: string; password: string; reset: boolean }
type ClientAccountsProps = { dict: Texts["portal"]; portal: Portal }

// Mot de passe provisoire affiché une seule fois, jusqu'à ce que le gérant le masque.
function CredentialsAlert({
  credentials,
  dict,
  onDone,
}: {
  credentials: Credentials
  dict: Texts["portal"]
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Alert role="status">
      <KeyRoundIcon />
      <AlertTitle>
        {format(credentials.reset ? dict.credentialsReset : dict.credentialsCreated, { email: credentials.email })}
      </AlertTitle>
      <AlertDescription>
        <p>
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-base tracking-wider text-foreground select-all">
            {credentials.password}
          </code>
        </p>
        <p>{dict.credentialsText}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(credentials.password)
              setCopied(true)
            }}
          >
            {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
            {copied ? dict.credentialsCopied : dict.credentialsCopy}
          </Button>
          <Button size="sm" onClick={onDone}>
            {dict.credentialsDone}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function ResetPasswordDialog({
  client,
  dict,
  portal,
  onReset,
}: {
  client: Client
  dict: Texts["portal"]
  portal: Portal
  onReset: (credentials: Credentials) => void
}) {
  const [open, setOpen] = useState(false)
  const { act, busy, setMessage } = portal
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>{dict.resetPassword}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dict.resetTitle}</AlertDialogTitle>
          <AlertDialogDescription>{format(dict.resetText, { name: client.name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{dict.resetCancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async () => {
              let password = ""
              const done = await act(
                { action: "reset-client-password", id: client.id },
                {
                  scope: "clients",
                  success: (result) => {
                    password = String(result.password)
                    return dict.saved
                  },
                },
              )
              setOpen(false)
              if (done) {
                // Le mot de passe affiché tient lieu de confirmation.
                setMessage(null)
                onReset({ email: client.email, password, reset: true })
              }
            }}
          >
            {dict.resetConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Carte « Comptes clients » de l'espace gérant : création, mot de passe provisoire, désactivation.
export function ClientAccounts({ dict, portal }: ClientAccountsProps) {
  const { data, busy, act, setMessage, feedbackFor, isInvalid, errorFor } = portal
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{dict.clientsTitle}</CardTitle>
        <CardDescription>{dict.clientsIntro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            const form = event.currentTarget
            const fields = Object.fromEntries(new FormData(form))
            let password = ""
            const done = await act(
              { action: "create-client", ...fields },
              {
                scope: "clients",
                success: (result) => {
                  password = String(result.password)
                  return dict.clientCreated
                },
              },
            )
            if (done) {
              setMessage(null)
              setCredentials({ email: String(fields.email).trim().toLowerCase(), password, reset: false })
              form.reset()
            }
          }}
        >
          <FieldGroup>
            <h3 className="text-xl font-semibold">{dict.createClientTitle}</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="client-name" data-invalid={isInvalid("clients", "name")}>
                  {dict.fullName}
                </FieldLabel>
                <Input
                  id="client-name"
                  aria-invalid={isInvalid("clients", "name")}
                  name="name"
                  autoComplete="off"
                  required
                  maxLength={160}
                />
                {errorFor("clients", "name")}
              </Field>
              <Field>
                <FieldLabel htmlFor="client-email" data-invalid={isInvalid("clients", "email")}>
                  {dict.email}
                </FieldLabel>
                <Input
                  id="client-email"
                  aria-invalid={isInvalid("clients", "email")}
                  name="email"
                  type="email"
                  autoComplete="off"
                  required
                  maxLength={254}
                />
                {errorFor("clients", "email")}
              </Field>
              <Field>
                <FieldLabel htmlFor="client-phone" data-invalid={isInvalid("clients", "phone")}>
                  {dict.phone}
                </FieldLabel>
                <Input
                  id="client-phone"
                  aria-invalid={isInvalid("clients", "phone")}
                  name="phone"
                  type="tel"
                  autoComplete="off"
                  required
                  maxLength={30}
                />
                {errorFor("clients", "phone")}
              </Field>
            </div>
            <Button type="submit" className="w-fit" disabled={busy}>
              <UserPlusIcon data-icon="inline-start" />
              {busy ? dict.creatingClient : dict.createClient}
            </Button>
          </FieldGroup>
        </form>
        {credentials && (
          <CredentialsAlert
            key={credentials.password}
            credentials={credentials}
            dict={dict}
            onDone={() => setCredentials(null)}
          />
        )}
        {feedbackFor("clients")}
        {!data?.clients?.length && <p className="text-muted-foreground">{dict.noClients}</p>}
        <ul className="divide-y">
          {data?.clients?.map((client) => (
            <li key={client.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {client.name}
                <span className="block text-sm text-muted-foreground">
                  {client.email}
                  {client.phone && ` · ${client.phone}`}
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {client.passwordTemporary && <Badge variant="secondary">{dict.temporaryBadge}</Badge>}
                <Badge variant={client.active ? "default" : "outline"}>
                  {client.active ? dict.active : dict.disabled}
                </Badge>
                <ResetPasswordDialog client={client} dict={dict} portal={portal} onReset={setCredentials} />
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
  )
}
