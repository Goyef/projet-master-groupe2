import type { Texts } from "../../content/texts"
import { format } from "../../lib/format"

// Limite du champ « Ce qui vous amène » (même valeur que INTENTION_MAX_LENGTH de lib/booking-prefill).
export const INTENTION_MAX = 1000

export type SeminarSummary = { size: string; topics: string; format: string; goal: string }

// Récapitulatif lisible repris tel quel dans « Ce qui vous amène », dans la langue de l'interface.
export function seminarIntention(dict: Texts["seminars"]["builder"], summary: SeminarSummary) {
  const line = (label: string, value: string) => format(dict.prefillLine, { label, value })
  const lines = [
    dict.prefillTitle,
    line(dict.summarySize, summary.size),
    line(dict.summaryTopics, summary.topics),
    line(dict.summaryFormat, summary.format),
  ]
  if (summary.goal) lines.push(line(dict.summaryGoal, summary.goal))
  return lines.join("\n").slice(0, INTENTION_MAX)
}
