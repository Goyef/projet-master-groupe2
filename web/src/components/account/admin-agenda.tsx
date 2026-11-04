"use client"

import { useState } from "react"
import { CalendarSyncIcon, CheckIcon, CopyIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { Texts } from "@/content/texts"

import { CalendlyDemo } from "./calendly-demo"
import type { PortalData } from "./use-portal"

type AdminAgendaProps = {
  dict: Texts["portal"]["agenda"]
  agenda: PortalData["agenda"]
  calendly: Omit<React.ComponentProps<typeof CalendlyDemo>, "dict">
}

// Carte « Agenda » du gérant : lien d'abonnement à copier dans Google Agenda et état de la synchronisation.
export function AdminAgenda({ dict, agenda, calendly }: AdminAgendaProps) {
  const [copied, setCopied] = useState(false)
  const feedUrl = agenda?.feedPath ? `${window.location.origin}${agenda.feedPath}` : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{dict.title}</CardTitle>
        <CardDescription>{dict.intro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert role="status">
          <CalendarSyncIcon />
          <AlertDescription>
            <p>{agenda?.googleSync ? dict.googleOn : dict.googleOff}</p>
            {agenda?.googleSync && <p>{agenda.googleMeet ? dict.googleMeetOn : dict.googleMeetOff}</p>}
          </AlertDescription>
        </Alert>
        {feedUrl ? (
          <Field>
            <FieldLabel htmlFor="agenda-feed">{dict.feedTitle}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <Input
                id="agenda-feed"
                value={feedUrl}
                readOnly
                className="min-w-0 flex-1 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(feedUrl)
                  setCopied(true)
                }}
              >
                {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                {copied ? dict.copied : dict.copy}
              </Button>
            </div>
            <FieldDescription>{dict.feedText}</FieldDescription>
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">{dict.feedMissing}</p>
        )}
        <Separator />
        <CalendlyDemo dict={dict.calendly} {...calendly} />
      </CardContent>
    </Card>
  )
}
