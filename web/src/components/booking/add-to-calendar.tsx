"use client"

import { CalendarPlusIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Texts } from "@/content/texts"
import { appointmentUid, googleCalendarUrl, toIcs, type CalendarEvent } from "@/lib/calendar"
import { format } from "@/lib/format"

type AddToCalendarProps = {
  dict: Texts["calendar"]
  appointment: { id: number; type: string; format: string; starts: number; ends: number }
  // Bouton clair sur fond foncé (carte « prochain rendez-vous »).
  variant?: "outline" | "secondary"
}

// Ajout du rendez-vous à l'agenda du client : Google Agenda ou fichier .ics (Apple, Outlook…).
export function AddToCalendar({ dict, appointment, variant = "outline" }: AddToCalendarProps) {
  function event(): CalendarEvent {
    const values = {
      type: appointment.type,
      format: appointment.format.toLowerCase(),
      minutes: Math.round((appointment.ends - appointment.starts) / 60000),
      url: `${window.location.origin}/connexion`,
    }
    return {
      uid: appointmentUid(appointment.id),
      title: format(dict.clientTitle, values),
      description: format(dict.clientDescription, values),
      location: appointment.format,
      starts: appointment.starts,
      ends: appointment.ends,
    }
  }

  function downloadIcs() {
    const file = new Blob([toIcs([event()], dict.clientTitle)], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = dict.fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant={variant} />}>
        <CalendarPlusIcon data-icon="inline-start" />
        {dict.add}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        <DropdownMenuItem onClick={() => window.open(googleCalendarUrl(event()), "_blank", "noopener,noreferrer")}>
          <ExternalLinkIcon />
          {dict.google}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadIcs}>
          <DownloadIcon />
          {dict.ics}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
