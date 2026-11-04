"use client"

import Link from "next/link"
import { useState } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { useLocalizedFetch } from "@/components/i18n/locale-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Texts } from "@/content/texts"

type Props = { dict: Texts["waitlist"]; networkError: string; token: string }

// Désinscription de la liste d'attente : confirmée par un clic (un simple affichage de la page,
// par exemple par l'analyseur de liens d'une messagerie, ne désinscrit pas).
export function WaitlistUnsubscribe({ dict, networkError, token }: Props) {
  const localizedFetch = useLocalizedFetch()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function confirm() {
    setBusy(true)
    setResult(null)
    try {
      const response = await localizedFetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waitlist-unsubscribe", token }),
      })
      const data = await response.json()
      setResult(response.ok ? { ok: true, message: dict.unsubscribed } : { ok: false, message: data.error })
    } catch {
      setResult({ ok: false, message: networkError })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-3xl">{dict.unsubscribeTitle}</CardTitle>
        <CardDescription>{token ? dict.unsubscribeIntro : dict.unsubscribeMissing}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {token && !result?.ok && (
          <Button size="lg" className="h-11" disabled={busy} onClick={confirm}>
            {busy ? dict.unsubscribing : dict.unsubscribeSubmit}
          </Button>
        )}
        {result && (
          <Alert variant={result.ok ? "default" : "destructive"} role="status">
            {result.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        <Link href="/rendez-vous" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {dict.backToBooking}
        </Link>
      </CardContent>
    </Card>
  )
}
