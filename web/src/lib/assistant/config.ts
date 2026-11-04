import "server-only";

// Configuration de l'assistant (API Responses d'OpenAI). Sans OPENAI_API_KEY, l'assistant est
// simplement désactivé : le bouton n'apparaît pas et /api/assistant répond 503.
// La clé reste côté serveur : jamais dans une variable NEXT_PUBLIC_ ni dans le navigateur.

const DEFAULT_URL = "https://api.openai.com/v1/responses";
export const DEFAULT_MODEL = "gpt-6.1-terra";

// Valeurs acceptées par gpt-6.1-terra pour `reasoning.effort` (« medium » par défaut côté OpenAI).
// « low » : réponses rapides, suffisantes pour un assistant de site avec outils.
const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

// Messages acceptés par jour, tous visiteurs confondus : plafond de dépense en cas d'abus.
const DEFAULT_DAILY_LIMIT = 500;

export type AssistantConfig = {
  apiKey: string;
  url: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  dailyLimit: number;
};

export function assistantConfig(): AssistantConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  const dailyLimit = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return {
    apiKey,
    // Paramétrable pour les tests (faux serveur OpenAI), comme RESEND_API_URL.
    url: process.env.OPENAI_API_URL?.trim() || DEFAULT_URL,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    reasoningEffort: (REASONING_EFFORTS as readonly string[]).includes(effort ?? "")
      ? (effort as ReasoningEffort)
      : "low",
    dailyLimit: Number.isSafeInteger(dailyLimit) && dailyLimit > 0 ? dailyLimit : DEFAULT_DAILY_LIMIT,
  };
}

export const assistantEnabled = () => assistantConfig() !== null;
