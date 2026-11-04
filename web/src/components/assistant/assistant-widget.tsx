"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowRightIcon, ArrowUpIcon, SquareIcon, SquarePenIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { Texts } from "@/content/texts"
import { ASSISTANT_MESSAGE_MAX } from "@/lib/assistant/protocol"
import { format } from "@/lib/format"
import mascotImage from "../../../public/brand/assistant/mascotte.png"

import { AssistantAvatar } from "./assistant-avatar"
import { AssistantBubble, AssistantMessage, AssistantRow } from "./assistant-message"
import { useAssistantChat } from "./use-assistant-chat"

export type AssistantWidgetProps = {
  dict: Texts["assistant"]
  crisis: Texts["crisis"]
  types: Texts["types"]
  closeLabel: string
  errors: { network: string; failed: string }
}

// Boutons de l'en-tête, posés sur le fond de la couleur principale.
const headerButton =
  "text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground aria-expanded:bg-transparent"

// Mascotte « Une question ? » en bas à droite de toutes les pages, et panneau de conversation.
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
            variant="ghost"
            aria-label={dict.launcherLabel}
            className="group/launcher fixed right-4 bottom-4 z-40 h-auto gap-3 rounded-full p-0 hover:bg-transparent active:not-aria-[haspopup]:translate-y-0 aria-expanded:bg-transparent print:hidden sm:right-6 sm:bottom-6"
          />
        }
      >
        <span className="hidden animate-in rounded-2xl rounded-br-md bg-card px-4 py-2.5 text-sm font-medium text-card-foreground shadow-lg ring-1 ring-foreground/10 transition-transform duration-300 fade-in slide-in-from-right-3 group-hover/launcher:-translate-x-1 sm:block">
          {dict.launcher}
        </span>
        {/* La mascotte salue une fois à l'arrivée sur le site (sauf mouvements réduits). */}
        <span className="animate-assistant-wave motion-reduce:animate-none">
          <AssistantAvatar
            online
            className="size-14 shadow-xl ring-4 ring-background transition-transform duration-300 group-hover/launcher:-translate-y-1 group-hover/launcher:scale-105 sm:size-16"
          />
        </span>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        // Au clavier ou à la souris, le curseur va dans le champ ; pas sur écran tactile (clavier virtuel).
        initialFocus={(openType) => (openType === "touch" ? true : inputRef.current)}
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center gap-3 bg-primary px-4 py-3.5 text-primary-foreground">
          <AssistantAvatar online className="size-11 ring-2 ring-primary-foreground/25" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-lg leading-tight text-primary-foreground">{dict.title}</SheetTitle>
            <p className="truncate text-xs text-primary-foreground/75">{dict.status}</p>
            <SheetDescription className="sr-only">{dict.description}</SheetDescription>
          </div>
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={headerButton}
              onClick={reset}
              aria-label={dict.newConversation}
              title={dict.newConversation}
            >
              <SquarePenIcon />
            </Button>
          )}
          <SheetClose
            render={<Button variant="ghost" size="icon-sm" className={headerButton} aria-label={closeLabel} title={closeLabel} />}
          >
            <XIcon />
          </SheetClose>
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
          className="flex-1 space-y-5 overflow-y-auto overscroll-contain bg-muted/40 px-4 py-5"
        >
          {entries.length === 0 ? (
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute inset-x-4 top-12 bottom-2 rounded-full bg-brand-diamond blur-2xl dark:bg-brand-sky/30"
                />
                <Image
                  src={mascotImage}
                  alt=""
                  sizes="140px"
                  className="relative h-44 w-auto animate-assistant-float drop-shadow-xl motion-reduce:animate-none"
                />
              </div>
              <p className="mt-4 font-heading text-2xl font-semibold">{dict.greeting}</p>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{dict.welcome}</p>
              <div className="mt-6 w-full space-y-2 text-left">
                <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{dict.suggestionsLabel}</p>
                {dict.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    className="h-auto w-full justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5 text-left font-normal whitespace-normal shadow-xs hover:border-brand-sky"
                    onClick={() => submit(suggestion)}
                  >
                    <span>{suggestion}</span>
                    <ArrowRightIcon data-icon="inline-end" className="text-brand-sky" />
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <AssistantRow>
                <AssistantBubble>
                  <p>
                    <strong className="font-semibold">{dict.greeting}</strong> {dict.welcome}
                  </p>
                </AssistantBubble>
              </AssistantRow>
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
            </>
          )}
        </div>

        <form
          className="space-y-2 border-t bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit(draft)
          }}
        >
          <InputGroup className="rounded-2xl bg-card shadow-xs">
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
              className="max-h-40 min-h-11 px-3.5"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <InputGroupText className="text-xs tabular-nums" aria-hidden={length < ASSISTANT_MESSAGE_MAX * 0.8}>
                {length >= ASSISTANT_MESSAGE_MAX * 0.8 ? format(dict.counter, { count: length, max: ASSISTANT_MESSAGE_MAX }) : ""}
              </InputGroupText>
              {busy ? (
                <InputGroupButton
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={stop}
                  aria-label={dict.stop}
                  title={dict.stop}
                >
                  <SquareIcon className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="rounded-full"
                  disabled={!draft.trim()}
                  aria-label={dict.send}
                  title={dict.send}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
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
