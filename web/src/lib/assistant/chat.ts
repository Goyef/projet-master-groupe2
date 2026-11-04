import "server-only";

import type { Texts } from "@/content/texts";
import { formatDateTime } from "@/lib/format";
import { languageNames, type Locale } from "@/lib/i18n";
import type { User } from "@/lib/store";
import type { AssistantConfig } from "./config";
import { knowledgeBase, pageLabel } from "./knowledge";
import { openResponseStream, readTurn, UpstreamError, type ModelTurn, type OutputItem } from "./openai";
import type { AssistantEvent, AssistantMessage } from "./protocol";
import { assistantTools } from "./tool-definitions";
import { runTool } from "./tools";

// Conduite d'une réponse de l'assistant : requête à OpenAI, appels d'outils, puis réponse finale.
//
// Ordre des éléments envoyés, pensé pour le cache des prompts d'OpenAI (début de requête identique
// d'une requête à l'autre) : 1. la base de connaissances (fixe pour une langue, commune à tous les
// visiteurs, marquée comme point de cache) ; 2. l'historique de la conversation ; 3. le contexte du
// moment (heure, page, type de visiteur), placé après la question pour ne pas invalider le cache ;
// 4. pendant la boucle d'outils, les appels et leurs résultats.

// Tours avec outils au plus pour une même question (créneaux, puis carte de réservation…).
const MAX_TOOL_ROUNDS = 3;
// Jetons de sortie au plus, raisonnement compris : une réponse de chat reste courte, mais le
// raisonnement doit garder de la marge pour ne pas couper la réponse.
const MAX_OUTPUT_TOKENS = 6000;

// Paramètres facultatifs (cache explicite, verbosité). Si OpenAI en refuse un (400), la requête est
// renvoyée sans eux et ils ne sont plus envoyés jusqu'au redémarrage : l'assistant reste disponible.
let optionalParametersRejected = false;

export type ChatInput = {
  messages: AssistantMessage[];
  page: string;
  user: User | null;
  locale: Locale;
  dict: Texts;
  // Le dernier message évoque une détresse (détection sans IA, voir safety.ts).
  crisis: boolean;
};

function contextNote(chat: ChatInput) {
  const page = pageLabel(chat.page, chat.locale);
  const visitor =
    chat.user?.role === "admin"
      ? "le gérant du site (Youcef), connecté à l'espace gérant"
      : chat.user?.role === "client"
        ? "un client connecté à son espace client"
        : "un visiteur non connecté";
  const lines = [
    "Contexte transmis par le site (pas par l'utilisateur), pour répondre au dernier message de l'utilisateur ; n'y réponds pas directement.",
    `- Date et heure à Paris : ${formatDateTime(Date.now(), "fr")}.`,
    `- Page consultée : ${chat.page}${page ? ` (${page})` : ""}.`,
    `- Langue de l'interface : ${languageNames[chat.locale]}.`,
    `- Interlocuteur : ${visitor}.`,
  ];
  if (chat.crisis)
    lines.push(
      "- Attention : le dernier message contient des mots qui évoquent une détresse ou des idées suicidaires. L'encart des numéros d'urgence est déjà affiché sous ta réponse : applique la règle « Détresse ».",
    );
  return lines.join("\n");
}

function requestBody(config: AssistantConfig, chat: ChatInput, toolItems: OutputItem[]) {
  const optional = !optionalParametersRejected;
  return {
    model: config.model,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: knowledgeBase(chat.locale),
            ...(optional ? { prompt_cache_breakpoint: { mode: "explicit" } } : {}),
          },
        ],
      },
      ...chat.messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "developer", content: contextNote(chat) },
      ...toolItems,
    ],
    tools: assistantTools,
    tool_choice: "auto",
    reasoning: { effort: config.reasoningEffort },
    ...(optional ? { text: { verbosity: "low" } } : {}),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    // Rien n'est conservé côté OpenAI pour être relu plus tard : l'historique est renvoyé à chaque fois.
    store: false,
    stream: true,
  };
}

// Un refus qui vise un paramètre facultatif justifie un nouvel essai sans eux.
function rejectsOptionalParameter(error: unknown) {
  if (!(error instanceof UpstreamError) || error.status !== 400 || optionalParametersRejected) return false;
  const subject = `${error.param ?? ""} ${error.message}`.toLowerCase();
  return /prompt_cache|verbosity|text\.|breakpoint/.test(subject);
}

export async function openTurn(config: AssistantConfig, chat: ChatInput, toolItems: OutputItem[], signal?: AbortSignal) {
  try {
    return await openResponseStream(config, requestBody(config, chat, toolItems), signal);
  } catch (error) {
    if (!rejectsOptionalParameter(error)) throw error;
    optionalParametersRejected = true;
    console.warn(
      `[assistant] paramètre facultatif refusé par OpenAI, nouvel essai sans cache explicite ni verbosité : ${(error as Error).message}`,
    );
    return openResponseStream(config, requestBody(config, chat, toolItems), signal);
  }
}

function logUsage(config: AssistantConfig, turn: ModelTurn) {
  const usage = turn.usage;
  if (!usage) return;
  // Compteurs seulement (aucun contenu) : suivi du coût et de l'efficacité du cache.
  console.info(
    `[assistant] ${config.model} ${turn.status} · entrée ${usage.input_tokens ?? "?"} (cache ${usage.input_tokens_details?.cached_tokens ?? 0}) · sortie ${usage.output_tokens ?? "?"} (raisonnement ${usage.output_tokens_details?.reasoning_tokens ?? 0})`,
  );
}

// Lit le premier tour (déjà ouvert par la route), exécute les outils demandés et enchaîne les tours
// jusqu'à la réponse finale. Les événements partent au navigateur au fil de l'eau.
export async function runConversation(
  config: AssistantConfig,
  chat: ChatInput,
  firstTurn: ReadableStream<Uint8Array>,
  emit: (event: AssistantEvent) => void,
  signal?: AbortSignal,
) {
  const toolItems: OutputItem[] = [];
  let stream = firstTurn;
  let wroteText = false;
  let newParagraph = false;
  const onText = (text: string) => {
    // Texte d'un nouveau tour après un appel d'outil : nouveau paragraphe.
    if (newParagraph && wroteText) emit({ type: "delta", text: "\n\n" });
    newParagraph = false;
    wroteText = true;
    emit({ type: "delta", text });
  };
  for (let round = 0; ; round++) {
    const turn = await readTurn(stream, onText);
    logUsage(config, turn);
    if (turn.status === "failed") throw new UpstreamError(0, "réponse en échec");
    const calls = turn.output.filter((item) => item.type === "function_call");
    if (!calls.length || turn.status !== "completed" || round >= MAX_TOOL_ROUNDS) {
      emit({ type: "done", ...(turn.status === "incomplete" ? { incomplete: true } : {}) });
      return;
    }
    // Les éléments du tour (raisonnement chiffré compris) sont renvoyés tels quels avec les résultats.
    toolItems.push(...turn.output);
    for (const call of calls) {
      const result = await runTool(String(call.name), call.arguments, {
        user: chat.user,
        locale: chat.locale,
        dict: chat.dict,
        emit,
      }).catch((error) => {
        console.error(`[assistant] outil ${String(call.name)} en échec :`, error);
        return { error: "tool_failed" };
      });
      toolItems.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
    newParagraph = true;
    stream = await openTurn(config, chat, toolItems, signal);
  }
}
