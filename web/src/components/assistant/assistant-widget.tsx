"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowUpIcon, MessageCircleIcon, SparklesIcon, SquareIcon, SquarePenIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Texts } from "@/content/texts"
import { ASSISTANT_MESSAGE_MAX } from "@/lib/assistant/protocol"
import { format } from "@/lib/format"

import { AssistantBubble, AssistantMessage } from "./assistant-message"
import { useAssistantChat } from "./use-assistant-chat"

export type AssistantWidgetProps = {
  dict: Texts["assistant"]
  crisis: Texts["crisis"]
  types: Texts["types"]
  closeLabel: string
  errors: { network: string; failed: string }
}

// Bouton flottant « Une question ? » et panneau de conversation, sur toutes les pages du site.
// La conversation suit la navigation (layout conservé) et reste dans l'onglet (sessionStorage).
export function AssistantWidget({ dict, crisis, types, closeLabel, errors }: AssistantWidgetProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const { entries, busy, send, stop, retry, reset } = useAssistantChat({ page: pathname, errors })
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)

  // Défilement automatique tant que la personne lit le bas de la conversation.
  useEffect(() => {
    const log = logRef.current
    if (log && followRef.current) log.scrollTop = log.scrollHeight
  }, [entries, open])

  function submit(text: string) {
    if (!text.trim() || busy) return
    followRef.current = true
    setDraft("")
    void send(text)
  }

  const close = () => setOpen(false)
  const length = draft.length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="lg"
            aria-label={dict.launcherLabel}
            className="fixed right-4 bottom-4 z-40 h-12 rounded-full px-4 shadow-lg print:hidden sm:right-6 sm:bottom-6"
          />
        }
      >
        <MessageCircleIcon data-icon="inline-start" className="size-5" />
        <span className="hidden sm:inline">{dict.launcher}</span>
      </SheetTrigger>
      <SheetContent
        side="right"
        closeLabel={closeLabel}
        // Au clavier ou à la souris, le curseur va dans le champ ; pas sur écran tactile (clavier virtuel).
        initialFocus={(openType) => (openType === "touch" ? true : inputRef.current)}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-start gap-3 border-b pr-12">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary dark:text-brand-sky">
            <SparklesIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <SheetTitle className="text-lg">{dict.title}</SheetTitle>
            <SheetDescription>{dict.description}</SheetDescription>
          </div>
          {entries.length > 0 && (
            <Button variant="ghost" size="icon-sm" onClick={reset} aria-label={dict.newConversation} title={dict.newConversation}>
              <SquarePenIcon />
            </Button>
          )}
        </SheetHeader>

        <div
          ref={logRef}
          role="log"
          aria-label={dict.title}
          aria-live="polite"
          aria-busy={busy}
          onScroll={(event) => {
            const log = event.currentTarget
            followRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80
          }}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
        >
          <AssistantBubble>
            <p>{dict.welcome}</p>
          </AssistantBubble>
          {entries.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{dict.suggestionsLabel}</p>
              <div className="flex flex-wrap gap-2">
                {dict.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="h-auto py-1.5 text-left whitespace-normal"
                    onClick={() => submit(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {entries.map((entry) => (
            <AssistantMessage
              key={entry.id}
              entry={entry}
              dict={dict}
              crisis={crisis}
              types={types}
              onRetry={retry}
              onNavigate={close}
            />
          ))}
        </div>

        <form
          className="space-y-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
        >
          <InputGroup>
            <InputGroupTextarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Entrée envoie, Maj + Entrée passe à la ligne (sauf pendant une composition IME).
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  submit(draft)
                }
              }}
              rows={1}
              maxLength={ASSISTANT_MESSAGE_MAX}
              placeholder={dict.placeholder}
              aria-label={dict.inputLabel}
              className="max-h-40 min-h-11"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <InputGroupText className="text-xs tabular-nums" aria-hidden={length < ASSISTANT_MESSAGE_MAX * 0.8}>
                {length >= ASSISTANT_MESSAGE_MAX * 0.8 ? format(dict.counter, { count: length, max: ASSISTANT_MESSAGE_MAX }) : ""}
              </InputGroupText>
              {busy ? (
                <InputGroupButton size="icon-sm" variant="outline" onClick={stop} aria-label={dict.stop} title={dict.stop}>
                  <SquareIcon className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  disabled={!draft.trim()}
                  aria-label={dict.send}
                  title={dict.send}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          <p className="text-xs text-muted-foreground">
            {dict.disclaimer}{" "}
            <Link href="/confidentialite" onClick={close} className="underline underline-offset-4 hover:no-underline">
              {dict.privacyLink}
            </Link>
          </p>
        </form>
      </SheetContent>
    </Sheet>
  )
}
