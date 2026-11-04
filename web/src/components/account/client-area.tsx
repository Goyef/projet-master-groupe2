"use client"

import type { BookingFormProps } from "@/components/booking/booking-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Texts } from "@/content/texts"

import { AdminDashboard } from "./admin-dashboard"
import { AuthPanel } from "./auth-panel"
import { ClientDashboard } from "./client-dashboard"
import { usePortal } from "./use-portal"

type ClientAreaProps = {
  dict: Texts["portal"]
  bookingDict: BookingFormProps["dict"]
  types: Texts["types"]
  formats: Texts["formats"]
  networkError: string
}

// Point d'entrée de l'espace connecté : connexion, espace client ou espace gérant.
export function ClientArea({ dict, bookingDict, types, formats, networkError }: ClientAreaProps) {
  const portal = usePortal(networkError, dict.saved)
  const { data, message, setMessage, refresh, feedbackFor } = portal

  if (!data)
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-16 sm:px-6">
        {message ? (
          <>
            {feedbackFor()}
            <Button onClick={() => refresh().catch((error: Error) => setMessage({ ok: false, text: error.message }))}>
              {dict.retry}
            </Button>
          </>
        ) : (
          <>
            <p className="sr-only" role="status">
              {dict.loading}
            </p>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
          </>
        )}
      </div>
    )

  if (!data.user) return <AuthPanel dict={dict} portal={portal} />

  if (data.user.role === "admin")
    return (
      <AdminDashboard
        dict={dict}
        types={types}
        formats={formats}
        loadingLabel={bookingDict.form.loading}
        waitlistDict={bookingDict.waitlist}
        portal={portal}
      />
    )

  return <ClientDashboard dict={dict} bookingDict={bookingDict} types={types} formats={formats} portal={portal} />
}
