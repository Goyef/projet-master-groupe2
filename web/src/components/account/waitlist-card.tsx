"use client"

import { HourglassIcon } from "lucide-react"

import { useDateFormatter } from "@/components/i18n/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Texts } from "@/content/texts"
import { format } from "@/lib/format"

import type { Portal, WaitlistEntry } from "./use-portal"

type WaitlistCardProps = {
  text: Texts["portal"]["client"]
  types: Texts["types"]
  entries: WaitlistEntry[]
  portal: Portal
}

// Espace client : créneaux complets pour lesquels le client attend une libération.
export function WaitlistCard({ text, types, entries, portal }: WaitlistCardProps) {
  const formatDateTime = useDateFormatter()
  const { busy, act, feedbackFor } = portal

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <HourglassIcon className="size-5 text-brand-sky" aria-hidden />
          {text.waitlistTitle}
        </CardTitle>
        <CardDescription>{text.waitlistIntro}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedbackFor("waitlist")}
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span>
                {formatDateTime(entry.starts)}
                <span className="block text-sm text-muted-foreground">{types[entry.type]}</span>
              </span>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{format(text.waitlistPosition, { position: entry.position })}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    act({ action: "leave-waitlist", id: entry.id }, { scope: "waitlist", success: () => text.leftWaitlist })
                  }
                >
                  {text.leaveWaitlist}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
