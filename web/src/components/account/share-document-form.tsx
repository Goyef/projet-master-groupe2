"use client"

import { Fragment, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { Texts } from "@/content/texts"

import type { Client, Portal } from "./use-portal"

type Audience = "all" | "selected"

// Formulaire « Partager un document » : PDF, seuil de séances et destinataires
// (tous les clients, ou plusieurs clients choisis dans une liste avec recherche).
export function ShareDocumentForm({ dict, portal }: { dict: Texts["portal"]; portal: Portal }) {
  const { data, busy, act, isInvalid, errorFor } = portal
  const [audience, setAudience] = useState<Audience>("all")
  const [selected, setSelected] = useState<Client[]>([])
  const anchor = useComboboxAnchor()
  const clients = data?.clients ?? []

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        const fields = new FormData(form)
        if (audience === "all") fields.set("all_clients", "true")
        else for (const client of selected) fields.append("user_ids", String(client.id))
        if (await act(fields, { scope: "documents" })) {
          form.reset()
          setAudience("all")
          setSelected([])
        }
      }}
    >
      <FieldGroup>
        <h3 className="text-xl font-semibold">{dict.shareTitle}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="doc-title" data-invalid={isInvalid("documents", "title")}>
              {dict.docTitle}
            </FieldLabel>
            <Input id="doc-title" aria-invalid={isInvalid("documents", "title")} name="title" required maxLength={160} />
            {errorFor("documents", "title")}
          </Field>
          <Field>
            <FieldLabel htmlFor="doc-sessions" data-invalid={isInvalid("documents", "required_sessions")}>
              {dict.requiredSessions}
            </FieldLabel>
            <Input
              id="doc-sessions"
              aria-invalid={isInvalid("documents", "required_sessions")}
              name="required_sessions"
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              step={1}
              defaultValue={0}
              required
            />
            <FieldDescription>{dict.requiredSessionsHint}</FieldDescription>
            {errorFor("documents", "required_sessions")}
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label">{dict.recipients}</FieldLegend>
          <RadioGroup
            value={audience}
            onValueChange={(value) => setAudience(value as Audience)}
            className="flex flex-wrap gap-6"
          >
            {(["all", "selected"] as const).map((value) => (
              <Field key={value} orientation="horizontal" className="w-auto">
                <RadioGroupItem value={value} id={`doc-audience-${value}`} />
                <FieldLabel htmlFor={`doc-audience-${value}`} className="font-normal">
                  {value === "all" ? dict.allClients : dict.selectedClients}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          {audience === "selected" && (
            <Field data-invalid={isInvalid("documents", "recipients")}>
              <Combobox
                multiple
                autoHighlight
                items={clients}
                value={selected}
                onValueChange={(value) => setSelected(value as Client[])}
                itemToStringLabel={(client: Client) => client.name}
                isItemEqualToValue={(item: Client, value: Client) => item.id === value.id}
              >
                <ComboboxChips ref={anchor} className="w-full">
                  <ComboboxValue>
                    {(values: Client[]) => (
                      <Fragment>
                        {values.map((client) => (
                          <ComboboxChip key={client.id}>{client.name}</ComboboxChip>
                        ))}
                        <ComboboxChipsInput
                          aria-label={dict.selectedClients}
                          aria-invalid={isInvalid("documents", "recipients")}
                          placeholder={values.length ? "" : dict.recipientsSearch}
                        />
                      </Fragment>
                    )}
                  </ComboboxValue>
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                  <ComboboxEmpty>{dict.recipientsEmpty}</ComboboxEmpty>
                  <ComboboxList>
                    {(client: Client) => (
                      <ComboboxItem key={client.id} value={client}>
                        <span className="flex flex-col">
                          <span>{client.name}</span>
                          <span className="text-xs text-muted-foreground">{client.email}</span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FieldDescription>{dict.recipientsHint}</FieldDescription>
              {errorFor("documents", "recipients")}
            </Field>
          )}
        </FieldSet>

        <Field>
          <FieldLabel htmlFor="doc-file" data-invalid={isInvalid("documents", "file")}>
            {dict.pdf}
          </FieldLabel>
          <Input
            id="doc-file"
            aria-invalid={isInvalid("documents", "file")}
            name="file"
            type="file"
            accept="application/pdf"
            required
          />
          {errorFor("documents", "file")}
        </Field>
        <Button type="submit" className="w-fit" disabled={busy || (audience === "selected" && !selected.length)}>
          {dict.share}
        </Button>
      </FieldGroup>
    </form>
  )
}
