// Questionnaire d'auto-évaluation : calcul du palier et résumé, entièrement dans le navigateur.
import { format } from "./format"

// Échelle : 0 = jamais … 3 = presque toujours.
export const QUIZ_SCALE_MAX = 3

export type QuizTier = "low" | "medium" | "high"

type QuizTexts = {
  scale: readonly string[]
  questions: readonly { short: string }[]
  tiers: Record<QuizTier, { title: string }>
  summaryTitle: string
  summaryLine: string
  summaryResult: string
}

export function quizScore(answers: readonly number[]) {
  return answers.reduce((total, value) => total + value, 0)
}

// Trois paliers de même largeur sur le score maximal (10 questions : 0–9, 10–19, 20–30).
export function quizTier(answers: readonly number[]): QuizTier {
  const ratio = quizScore(answers) / (answers.length * QUIZ_SCALE_MAX || 1)
  return ratio < 1 / 3 ? "low" : ratio < 2 / 3 ? "medium" : "high"
}

// Résumé court joint, si la personne le choisit, au champ « Ce qui vous amène ».
export function quizSummary(dict: QuizTexts, answers: readonly number[]) {
  return [
    dict.summaryTitle,
    ...dict.questions.map((question, index) =>
      format(dict.summaryLine, { question: question.short, answer: (dict.scale[answers[index]] ?? "").toLowerCase() }),
    ),
    format(dict.summaryResult, { result: dict.tiers[quizTier(answers)].title }),
  ].join("\n")
}
