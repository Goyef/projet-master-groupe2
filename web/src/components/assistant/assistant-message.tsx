"use client"

import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { CrisisResources } from "@/components/sections/crisis-resources"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Texts } from "@/content/texts"
import { cn } from "@/lib/utils"

import { AssistantMarkdown } from "./assistant-markdown"
import { BookingProposal } from "./booking-proposal"
import type { ChatEntry } from "./use-assistant-chat"

type AssistantMessageProps = {
  entry: ChatEntry
  dict: Texts["assistant"]
  crisis: Texts["crisis"]
  types: Texts["types"]
  onRetry: (id: string) => void
  onNavigate: () => void
}

export function AssistantBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground", className)}>
      {children}
    </div>
  )
}

export function AssistantMessage({ entry, dict, crisis, types, onRetry, onNavigate }: AssistantMessageProps) {
  if (entry.role === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          <span className="sr-only">{dict.you} : </span>
          {entry.content}
        </p>
      </div>
    )

  const waiting = entry.state === "streaming" && (!entry.content || entry.status)
  const empty = entry.state === "done" && !entry.content.trim() && entry.actions.length === 0
  return (
    <div className="space-y-2">
      {/* Les numéros d'urgence passent avant la réponse. */}
      {entry.actions
        .filter((action) => action.kind === "crisis")
        .slice(0, 1)
        .map((action) => (
          <CrisisResources key={action.kind} dict={crisis} />
        ))}
      {(entry.content || empty) && (
        <AssistantBubble>
          <span className="sr-only">{dict.assistantName} : </span>
          {empty ? <p>{dict.empty}</p> : <AssistantMarkdown text={entry.content} onNavigate={onNavigate} />}
        </AssistantBubble>
      )}
      {waiting && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Spinner className="size-3.5" aria-hidden />
          {entry.status === "slots" ? dict.checkingSlots : dict.thinking}
        </p>
      )}
      {entry.state === "incomplete" && <p className="text-xs text-muted-foreground">{dict.incomplete}</p>}
      {entry.state === "error" && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{entry.error}</span>
            <Button size="xs" variant="outline" onClick={() => onRetry(entry.id)}>
              <RotateCcwIcon data-icon="inline-start" />
              {dict.retry}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {entry.actions.map((action, index) =>
        action.kind === "booking" ? (
          <BookingProposal
            key={index}
            appointmentType={action.appointmentType}
            intention={action.intention}
            dict={dict}
            types={types}
            onNavigate={onNavigate}
          />
        ) : null,
      )}
    </div>
  )
}
