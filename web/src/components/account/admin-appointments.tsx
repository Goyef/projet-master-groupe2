"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { useDateFormatter } from "@/components/i18n/locale-provider"
import { Badge } from "@/components/ui/badge"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Texts } from "@/content/texts"
import { cn } from "@/lib/utils"

import { appointmentTone, typeLabel } from "./admin-calendar"
import type { Appointment } from "./use-portal"

type Filter = "upcoming" | "past" | "cancelled" | "all"

type AdminAppointmentsProps = {
  appointments: Appointment[]
  dict: Texts["portal"]
  types: Texts["types"]
  formats: Texts["formats"]
  onSelect: (appointment: Appointment) => void
}

// Liste des rendez-vous du gérant : filtres, recherche, ouverture du panneau d'actions.
export function AdminAppointments({ appointments, dict, types, formats, onSelect }: AdminAppointmentsProps) {
  const text = dict.dashboard
  const formatDateTime = useDateFormatter()
  const [filter, setFilter] = useState<Filter>("upcoming")
  const [query, setQuery] = useState("")

  const lists = useMemo(
    () => ({
      upcoming: appointments
        .filter((item) => item.status === "confirmed" && !item.past)
        .sort((a, b) => a.starts - b.starts),
      past: appointments.filter((item) => item.status === "confirmed" && item.past),
      cancelled: appointments.filter((item) => item.status === "cancelled"),
      all: appointments,
    }),
    [appointments],
  )

  const search = query.trim().toLowerCase()
  const shown = lists[filter].filter(
    (item) =>
      !search ||
      [item.name, item.email, item.phone ?? ""].some((value) => value.toLowerCase().includes(search)),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList>
            {(["upcoming", "past", "cancelled", "all"] as const).map((key) => (
              <TabsTrigger key={key} value={key}>
                {key === "upcoming"
                  ? text.filterUpcoming
                  : key === "past"
                    ? text.filterPast
                    : key === "cancelled"
                      ? text.filterCancelled
                      : text.filterAll}
                <span className="text-muted-foreground tabular-nums">{lists[key].length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={text.search}
            placeholder={text.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
      </div>

      {!shown.length ? (
        <p className="text-muted-foreground">{text.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.colDate}</TableHead>
                <TableHead>{dict.colType}</TableHead>
                <TableHead>{dict.colContact}</TableHead>
                <TableHead>{dict.colStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  aria-label={`${text.open} : ${item.name}, ${formatDateTime(item.starts)}`}
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelect(item)
                    }
                  }}
                >
                  <TableCell className="whitespace-normal first-letter:uppercase">{formatDateTime(item.starts)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2.5 shrink-0 rounded-full border", appointmentTone(item))} />
                      {typeLabel(types, item.type)}
                    </span>
                    <span className="block text-muted-foreground">{formats[item.format]}</span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {item.name}
                    <span className="block text-muted-foreground">{item.email}</span>
                  </TableCell>
                  <TableCell>
                    {item.status === "cancelled" ? (
                      <Badge variant="outline">{dict.statusCancelled}</Badge>
                    ) : item.completed ? (
                      <Badge>{dict.statusDone}</Badge>
                    ) : (
                      <Badge variant="secondary">{dict.statusConfirmed}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
