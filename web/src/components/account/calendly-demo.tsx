"use client"

import { useState } from "react"
import { CalendarCheckIcon, LinkIcon, RefreshCwIcon, ShieldCheckIcon, UnplugIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { Texts } from "@/content/texts"
import { format, TIME_ZONE } from "@/lib/format"
import { intlLocales } from "@/lib/i18n"
import { useLocale } from "@/components/i18n/locale-provider"

type CalendlyDemoProps = {
  dict: Texts["portal"]["agenda"]["calendly"]
  // Adresse proposée pour le compte Calendly (celle du gérant).
  email: string
  eventTypes: { label: string; minutes: number; slug: string }[]
  upcoming: number
}

type Connection = { email: string; lastSync: number }

// Démonstration : l'état de la « connexion » reste dans le navigateur, aucune requête n'est envoyée à Calendly.
const STORAGE_KEY = "synego-calendly-demo"
const DELAY_MS = 1200

function readConnection(): Connection | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    return value && typeof value.email === "string" && typeof value.lastSync === "number" ? value : null
  } catch {
    return null
  }
}

function saveConnection(connection: Connection | null) {
  try {
    if (connection) localStorage.setItem(STORAGE_KEY, JSON.stringify(connection))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS))

export function CalendlyDemo({ dict, email, eventTypes, upcoming }: CalendlyDemoProps) {
  const locale = intlLocales[useLocale()]
  // Rendu uniquement côté client (espace connecté chargé après coup) : lecture directe du stockage local.
  const [connection, setConnection] = useState<Connection | null>(() =>
    typeof window === "undefined" ? null : readConnection(),
  )
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState(email)
  const [pending, setPending] = useState<"connect" | "sync" | null>(null)
  const [synced, setSynced] = useState(false)

  function update(next: Connection | null) {
    saveConnection(next)
    setConnection(next)
  }

  async function connect() {
    setPending("connect")
    await wait()
    update({ email: account.trim() || email, lastSync: Date.now() })
    setPending(null)
    setOpen(false)
  }

  async function sync() {
    if (!connection) return
    setPending("sync")
    setSynced(false)
    await wait()
    update({ ...connection, lastSync: Date.now() })
    setPending(null)
    setSynced(true)
  }

  const time = (value: number) =>
    new Date(value).toLocaleString(locale, { timeZone: TIME_ZONE, dateStyle: "short", timeStyle: "short" })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarCheckIcon className="size-5 text-brand-sky" aria-hidden />
        <h3 className="font-sans text-lg font-semibold">{dict.title}</h3>
        <Badge variant={connection ? "default" : "outline"}>{connection ? dict.connected : dict.disconnected}</Badge>
        <Badge variant="secondary">{dict.demo}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{dict.demoNote}</p>

      {!connection ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{dict.disconnectedText}</p>
          <Dialog open={open} onOpenChange={(next) => pending === null && setOpen(next)}>
            <DialogTrigger render={<Button />}>
              <LinkIcon data-icon="inline-start" />
              {dict.connect}
            </DialogTrigger>
            <DialogContent closeLabel={dict.close}>
              <DialogHeader>
                <DialogTitle>{dict.dialogTitle}</DialogTitle>
                <DialogDescription>{dict.dialogText}</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2 text-sm">
                {dict.permissions.map((permission) => (
                  <li key={permission} className="flex gap-2">
                    <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand-sky" aria-hidden />
                    <span>{permission}</span>
                  </li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor="calendly-account">{dict.account}</FieldLabel>
                <Input
                  id="calendly-account"
                  type="email"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  disabled={pending !== null}
                />
              </Field>
              <p className="text-xs text-muted-foreground">{dict.demoNote}</p>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" disabled={pending !== null} />}>{dict.cancel}</DialogClose>
                <Button onClick={connect} disabled={pending !== null}>
                  {pending === "connect" && <Spinner data-icon="inline-start" aria-label={dict.connecting} />}
                  {pending === "connect" ? dict.connecting : dict.authorize}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            <p>{format(dict.connectedAs, { email: connection.email })}</p>
            <p className="text-muted-foreground">{format(dict.lastSync, { time: time(connection.lastSync) })}</p>
            <p className="text-muted-foreground">{format(dict.upcoming, { count: upcoming })}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{dict.eventTypes}</p>
            <ul className="flex flex-wrap gap-2">
              {eventTypes.map((event) => (
                <li key={event.slug}>
                  <Badge variant="outline" className="h-7" title={`calendly.com/synego/${event.slug}`}>
                    {event.label} · {event.minutes} min
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={sync} disabled={pending !== null}>
              {pending === "sync" ? (
                <Spinner data-icon="inline-start" aria-label={dict.syncing} />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {pending === "sync" ? dict.syncing : dict.sync}
            </Button>
            <Button
              variant="ghost"
              disabled={pending !== null}
              onClick={() => {
                setSynced(false)
                update(null)
              }}
            >
              <UnplugIcon data-icon="inline-start" />
              {dict.disconnect}
            </Button>
            {synced && (
              <span role="status" className="text-sm text-muted-foreground">
                {dict.synced}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
