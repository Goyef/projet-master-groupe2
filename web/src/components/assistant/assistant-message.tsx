"use client"

import { CircleAlertIcon, RotateCcwIcon } from "lucide-react"

import { CrisisResources } from "@/components/sections/crisis-resources"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Texts } from "@/content/texts"
import { cn } from "@/lib/utils"

import { AssistantAvatar } from "./assistant-avatar"
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

// Ligne de l'assistant : visage de la mascotte à gauche, contenu (bulle, cartes) à droite.
export function AssistantRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <AssistantAvatar variant="face" className="mt-0.5 size-8 shadow-sm" />
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  )
}

export function AssistantBubble({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-fit max-w-full rounded-2xl rounded-tl-md bg-card px-3.5 py-2.5 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    />
  )
}

// Trois points qui rebondissent pendant que l'assistant prépare sa réponse.
function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <AssistantBubble className="flex items-center gap-1 px-3.5 py-3" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-bounce rounded-full bg-brand-sky motion-reduce:animate-none"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </AssistantBubble>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function AssistantMessage({ entry, dict, crisis, types, onRetry, onNavigate }: AssistantMessageProps) {
  if (entry.role === "user")
    return (
      <div className="flex justify-end pl-10">
        <p className="max-w-full rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground shadow-xs">
          <span className="sr-only">{dict.you} : </span>
          {entry.content}
        </p>
      </div>
    )

  const waiting = entry.state === "streaming" && (!entry.content || entry.status)
  const empty = entry.state === "done" && !entry.content.trim() && entry.actions.length === 0
  return (
    <AssistantRow>
      {/* Les numéros d'urgence passent avant la réponse. */}
      {entry.actions.some((action) => action.kind === "crisis") && <CrisisResources dict={crisis} className="bg-card" />}
      {(entry.content || empty) && (
        <AssistantBubble>
          <span className="sr-only">{dict.assistantName} : </span>
          {empty ? <p>{dict.empty}</p> : <AssistantMarkdown text={entry.content} onNavigate={onNavigate} />}
        </AssistantBubble>
      )}
      {waiting && <TypingIndicator label={entry.status === "slots" ? dict.checkingSlots : dict.thinking} />}
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
    </AssistantRow>
  )
}
