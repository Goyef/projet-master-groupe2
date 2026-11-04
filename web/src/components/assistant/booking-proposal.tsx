"use client"

import { usePathname, useRouter } from "next/navigation"
import { CalendarCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Texts } from "@/content/texts"
import { announceBookingPrefill, saveBookingPrefill } from "@/lib/booking-prefill"
import type { BookableType } from "@/lib/assistant/protocol"
import { format } from "@/lib/format"

type BookingProposalProps = {
  appointmentType: BookableType
  intention: string
  dict: Texts["assistant"]
  types: Texts["types"]
  onNavigate: () => void
}

// Carte proposée par l'assistant : ouvre la réservation avec le type présélectionné et, au choix
// de la personne, le résumé dans « Ce qui vous amène ». Contrat de préremplissage partagé avec le
// questionnaire et le configurateur (sessionStorage, jamais dans l'URL) ; rien n'est envoyé ici.
export function BookingProposal({ appointmentType, intention, dict, types, onNavigate }: BookingProposalProps) {
  const router = useRouter()
  const pathname = usePathname()

  function open(withSummary: boolean) {
    saveBookingPrefill({ type: appointmentType, intention: withSummary ? intention : "" })
    // Formulaire déjà affiché : il relit le préremplissage sans attendre un nouveau montage.
    if (pathname === "/rendez-vous") announceBookingPrefill()
    onNavigate()
    router.push("/rendez-vous")
  }

  return (
    <Card size="sm" className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheckIcon className="size-4 text-brand-sky" aria-hidden />
          {format(dict.bookingTitle, { type: types[appointmentType] })}
        </CardTitle>
        <CardDescription>{dict.bookingNote}</CardDescription>
      </CardHeader>
      {intention && (
        <CardContent className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{dict.bookingSummary}</p>
          <blockquote className="rounded-md border-l-2 border-brand-sky bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">
            {intention}
          </blockquote>
        </CardContent>
      )}
      <CardFooter className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open(true)}>
          {intention ? dict.bookingWithSummary : dict.bookingOpen}
        </Button>
        {intention && (
          <Button size="sm" variant="outline" onClick={() => open(false)}>
            {dict.bookingWithoutSummary}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
