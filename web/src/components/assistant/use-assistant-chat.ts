"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useLocalizedFetch } from "@/components/i18n/locale-provider"
import {
  ASSISTANT_HISTORY_MAX,
  ASSISTANT_STORAGE_KEY,
  type AssistantAction,
  type AssistantEvent,
  type AssistantMessage,
} from "@/lib/assistant/protocol"

export type ChatEntry = {
  id: string
  role: "user" | "assistant"
  content: string
  // Éléments affichés sous la réponse : carte de réservation, numéros d'urgence.
  actions: AssistantAction[]
  state: "streaming" | "done" | "incomplete" | "error"
  // Outil en cours (consultation des créneaux…).
  status?: "slots"
  error?: string
}

// Messages conservés dans l'onglet : au-delà, les plus anciens sont oubliés.
const STORED_ENTRIES_MAX = 40

let sequence = 0
const newId = () => `${Date.now().toString(36)}-${(sequence++).toString(36)}`

// Conversation de l'onglet (sessionStorage) : elle survit aux rechargements, pas à la fermeture.
function loadEntries(): ChatEntry[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(ASSISTANT_STORAGE_KEY) ?? "null") as { entries?: unknown } | null
    if (!stored || !Array.isArray(stored.entries)) return []
    return stored.entries
      .filter(
        (entry): entry is ChatEntry =>
          !!entry &&
          typeof entry === "object" &&
          (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string" &&
          typeof entry.id === "string",
      )
      .map((entry) => ({
        ...entry,
        actions: Array.isArray(entry.actions) ? entry.actions : [],
        // Une réponse coupée par un rechargement reste affichée comme interrompue.
        state: entry.state === "streaming" ? "incomplete" : entry.state,
        status: undefined,
      }))
  } catch {
    return []
  }
}

function saveEntries(entries: ChatEntry[]) {
  try {
    if (entries.length) sessionStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify({ version: 1, entries: entries.slice(-STORED_ENTRIES_MAX) }))
    else sessionStorage.removeItem(ASSISTANT_STORAGE_KEY)
  } catch {}
}

// Historique transmis au serveur : questions et réponses abouties, les plus récentes seulement.
function historyOf(entries: ChatEntry[]): AssistantMessage[] {
  return entries
    .filter((entry) => entry.role === "user" || (entry.content.trim() && entry.state !== "error"))
    .map((entry) => ({ role: entry.role, content: entry.content }))
    .slice(-ASSISTANT_HISTORY_MAX)
}

export function useAssistantChat({ page, errors }: { page: string; errors: { network: string; failed: string } }) {
  const localizedFetch = useLocalizedFetch()
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [busy, setBusy] = useState(false)
  const entriesRef = useRef(entries)
  const controllerRef = useRef<AbortController | null>(null)
  const restored = useRef(false)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  // Restauration après le montage : le stockage n'existe pas au rendu serveur.
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active || restored.current) return
      restored.current = true
      setEntries(loadEntries())
    })
    return () => {
      active = false
    }
  }, [])

  // Enregistrement une fois la réponse terminée (pas à chaque fragment de texte).
  useEffect(() => {
    if (restored.current && !busy) saveEntries(entries)
  }, [entries, busy])

  // Interrompt la réponse en cours si le widget disparaît.
  useEffect(() => () => controllerRef.current?.abort(), [])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || controllerRef.current) return
      const user: ChatEntry = { id: newId(), role: "user", content: question, actions: [], state: "done" }
      const reply: ChatEntry = { id: newId(), role: "assistant", content: "", actions: [], state: "streaming" }
      const messages = historyOf([...entriesRef.current, user])
      setEntries((previous) => [...previous, user, reply])
      setBusy(true)
      const controller = new AbortController()
      controllerRef.current = controller
      const update = (change: (entry: ChatEntry) => ChatEntry) =>
        setEntries((previous) => previous.map((entry) => (entry.id === reply.id ? change(entry) : entry)))

      const apply = (event: AssistantEvent) => {
        if (event.type === "delta") update((entry) => ({ ...entry, content: entry.content + event.text, status: undefined }))
        else if (event.type === "status") update((entry) => ({ ...entry, status: event.status }))
        else if (event.type === "action")
          update((entry) =>
            // Un seul encart d'urgence par réponse, même s'il est demandé deux fois.
            event.action.kind === "crisis" && entry.actions.some((action) => action.kind === "crisis")
              ? entry
              : { ...entry, actions: [...entry.actions, event.action] },
          )
        else if (event.type === "done")
          update((entry) => ({ ...entry, state: event.incomplete ? "incomplete" : "done", status: undefined }))
        else if (event.type === "error")
          update((entry) => ({ ...entry, state: "error", error: event.message, status: undefined }))
      }

      try {
        const response = await localizedFetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, page }),
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error || errors.failed)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finished = false
        while (true) {
          const { value, done } = await reader.read()
          buffer += decoder.decode(value, { stream: !done })
          let newline: number
          while ((newline = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newline).trim()
            buffer = buffer.slice(newline + 1)
            if (!line) continue
            try {
              const event = JSON.parse(line) as AssistantEvent
              if (event.type === "done" || event.type === "error") finished = true
              apply(event)
            } catch {}
          }
          if (done) break
        }
        // Flux coupé sans fin annoncée : ce qui est arrivé reste affiché, marqué comme interrompu.
        if (!finished)
          update((entry) =>
            entry.content ? { ...entry, state: "incomplete", status: undefined } : { ...entry, state: "error", error: errors.failed, status: undefined },
          )
      } catch (error) {
        if (controller.signal.aborted) update((entry) => ({ ...entry, state: "incomplete", status: undefined }))
        else
          update((entry) => ({
            ...entry,
            state: "error",
            // TypeError : le serveur est injoignable (réseau coupé…).
            error: error instanceof TypeError ? errors.network : (error as Error).message || errors.failed,
            status: undefined,
          }))
      } finally {
        controllerRef.current = null
        setBusy(false)
      }
    },
    [localizedFetch, page, errors.failed, errors.network],
  )

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  // Relance la question d'une réponse en échec.
  const retry = useCallback(
    (replyId: string) => {
      if (controllerRef.current) return
      const list = entriesRef.current
      const index = list.findIndex((entry) => entry.id === replyId)
      const question = list[index - 1]
      if (index < 1 || question?.role !== "user") return
      const remaining = list.filter((_, position) => position !== index && position !== index - 1)
      entriesRef.current = remaining
      setEntries(remaining)
      void send(question.content)
    },
    [send],
  )

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    entriesRef.current = []
    setEntries([])
  }, [])

  return { entries, busy, send, stop, retry, reset }
}
