"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { FieldError } from "@/components/ui/field"
import type { Texts } from "@/content/texts"

export type Appointment = {
  id: number
  type: keyof Texts["types"]
  format: keyof Texts["formats"]
  status: "confirmed" | "cancelled"
  name: string
  email: string
  phone?: string
  intention?: string
  completed: boolean
  past: boolean
  starts: number
  ends: number
  // Le client peut encore l'annuler ou le déplacer (plus de 24 h avant).
  changeable: boolean
}
export type Client = {
  id: number
  name: string
  email: string
  phone: string | null
  active: boolean
  // Le client n'a pas encore remplacé le mot de passe provisoire généré par le gérant.
  passwordTemporary: boolean
}
export type PortalData = {
  user: {
    name: string
    email: string
    role: "admin" | "client"
    phone: string | null
    passwordTemporary: boolean
  } | null
  appointments?: Appointment[]
  // `unlocked` : le client a réalisé au moins `required_sessions` séances (toujours vrai pour le gérant).
  documents?: { id: number; title: string; user_id: number | null; required_sessions: number; unlocked: boolean }[]
  completedSessions?: number
  clients?: Client[]
  slots?: { id: number; starts: number; ends: number; appointment_id: number | null }[]
}

// `scope` : carte où afficher le message (à côté du formulaire utilisé) ; absent = haut de page.
// `field` : champ fautif renvoyé par l'API ; l'erreur s'affiche alors sous ce champ.
export type Message = { ok: boolean; text: string; scope?: string; field?: string }
export type ActOptions = { success?: (result: Record<string, string | number>) => string; scope?: string }

// État partagé de l'espace connecté : données, envoi des actions et messages de retour.
export function usePortal(networkError: string, savedText: string) {
  const [data, setData] = useState<PortalData | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<PortalData> => {
    const response = await fetch("/api/portal", { cache: "no-store" })
    if (!response.ok) throw new Error(networkError)
    return response.json()
  }, [networkError])

  const refresh = useCallback(async () => {
    setData(await load())
  }, [load])

  useEffect(() => {
    let active = true
    load()
      .then((result) => active && setData(result))
      .catch((error: Error) => active && setMessage({ ok: false, text: error.message }))
    return () => {
      active = false
    }
  }, [load])

  async function act(payload: Record<string, unknown> | FormData, { success, scope }: ActOptions = {}) {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch("/api/portal", {
        method: "POST",
        ...(payload instanceof FormData
          ? { body: payload }
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      })
      const result = await response.json()
      if (!response.ok) {
        setMessage({ ok: false, text: result.error, scope, field: result.field })
        return false
      }
      await refresh()
      setMessage({ ok: true, text: success ? success(result) : savedText, scope })
      return true
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : networkError, scope })
      return false
    } finally {
      setBusy(false)
    }
  }

  // Envoie un formulaire ; il est vidé si l'action réussit.
  function submit(
    action: string,
    transform?: (fields: FormData) => Record<string, unknown>,
    options?: ActOptions & { keep?: boolean },
  ) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      const fields = new FormData(form)
      const done = await act({ action, ...(transform ? transform(fields) : Object.fromEntries(fields)) }, options)
      if (done && !options?.keep) form.reset()
    }
  }

  // Message général d'une carte, sauf si l'erreur concerne un champ précis.
  const feedbackFor = (scope?: string) =>
    message &&
    message.scope === scope &&
    !message.field && (
      <Alert variant={message.ok ? "default" : "destructive"} role="status">
        {message.ok ? <CircleCheckIcon /> : <CircleAlertIcon />}
        <AlertDescription>{message.text}</AlertDescription>
      </Alert>
    )

  const isInvalid = (scope: string, field: string) =>
    !!message && !message.ok && message.scope === scope && message.field === field
  const errorFor = (scope: string, field: string) =>
    isInvalid(scope, field) && <FieldError>{message?.text}</FieldError>

  return { data, message, setMessage, busy, refresh, act, submit, feedbackFor, isInvalid, errorFor }
}

export type Portal = ReturnType<typeof usePortal>
