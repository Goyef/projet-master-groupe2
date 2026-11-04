import { NextRequest, NextResponse } from "next/server";

import { getDictionary } from "@/content/dictionaries";
import type { Texts } from "@/content/texts";
import { runConversation, openTurn, type ChatInput } from "@/lib/assistant/chat";
import { assistantConfig } from "@/lib/assistant/config";
import { consumeAssistantQuota, visitorKey } from "@/lib/assistant/limits";
import { UpstreamError } from "@/lib/assistant/openai";
import type { AssistantEvent } from "@/lib/assistant/protocol";
import { parseAssistantRequest } from "@/lib/assistant/request";
import { mentionsCrisis } from "@/lib/assistant/safety";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/lib/i18n";
import { currentUser, type User } from "@/lib/store";

// Assistant du site : POST { messages, page } → réponse en flux, une ligne JSON par événement
// (voir src/lib/assistant/protocol.ts). Les erreurs avant le flux suivent le format de /api/portal :
// { error, code, field? } avec un message dans la langue de l'interface.

// Une réponse avec outils peut demander plusieurs appels à OpenAI.
export const maxDuration = 60;

type ErrorCode = keyof Texts["errors"];

// Langue de l'interface : celle transmise par le widget (Accept-Language), sinon le cookie.
function requestLocale(request: NextRequest): Locale {
  const preference = request.cookies.get(LOCALE_COOKIE)?.value;
  const language = request.headers.get("accept-language");
  return language ? negotiateLocale(language) : isLocale(preference) ? preference : "fr";
}

// Même contrôle d'origine que /api/portal : seules les pages du site peuvent appeler l'assistant.
function sameOrigin(request: NextRequest) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    return ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.get("host");
  } catch {
    return false;
  }
}

// Compte connecté, s'il y en a un ; une base indisponible ne doit pas empêcher de répondre.
async function signedInUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  return currentUser(token).catch((error) => {
    console.error("[assistant] session illisible :", error);
    return null;
  });
}

export async function POST(request: NextRequest) {
  const locale = requestLocale(request);
  const dict = getDictionary(locale);
  const failure = (code: ErrorCode, status: number, field?: string) => {
    const result = NextResponse.json(
      { error: dict.errors[code], code, ...(field ? { field } : {}) },
      { status, headers: { "Cache-Control": "no-store", "Content-Language": locale } },
    );
    if (status === 429) result.headers.set("Retry-After", "900");
    return result;
  };

  if (!sameOrigin(request)) return failure("originRefused", 403);
  const config = assistantConfig();
  if (!config) return failure("assistantUnavailable", 503);
  if (Number(request.headers.get("content-length") || 0) > 100_000) return failure("tooLarge", 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("invalidField", 400, "messages");
  }
  const parsed = parseAssistantRequest(body);
  if (!parsed.ok) return failure(parsed.code, 400, parsed.field);

  const quota = await consumeAssistantQuota(visitorKey(request.headers), config.dailyLimit);
  if (quota === "visitor") return failure("assistantRateLimited", 429);
  if (quota === "daily") return failure("assistantDailyLimit", 429);

  const { messages, page } = parsed.value;
  const chat: ChatInput = {
    messages,
    page,
    user: await signedInUser(request),
    locale,
    dict,
    crisis: mentionsCrisis(messages.at(-1)?.content ?? ""),
  };

  // La connexion à OpenAI est ouverte avant de répondre : un refus donne un vrai code d'erreur.
  // Si le visiteur ferme la conversation, la requête vers OpenAI est interrompue aussi.
  const upstream = new AbortController();
  request.signal.addEventListener("abort", () => upstream.abort(), { once: true });
  const timeout = setTimeout(() => upstream.abort(), (maxDuration - 5) * 1000);
  let firstTurn: ReadableStream<Uint8Array>;
  try {
    firstTurn = await openTurn(config, chat, [], upstream.signal);
  } catch (error) {
    clearTimeout(timeout);
    console.error("[assistant] OpenAI indisponible :", error instanceof UpstreamError ? `${error.status} ${error.code ?? ""} ${error.message}` : error);
    return failure("assistantFailed", 502);
  }

  const encoder = new TextEncoder();
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AssistantEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        // Filet de sécurité : les numéros d'urgence s'affichent avant même la réponse du modèle.
        if (chat.crisis) emit({ type: "action", action: { kind: "crisis" } });
        await runConversation(config, chat, firstTurn, emit, upstream.signal);
      } catch (error) {
        // Visiteur parti : rien à signaler. Sinon (panne, délai dépassé), le widget affiche l'erreur.
        if (open && !request.signal.aborted) {
          console.error("[assistant] réponse interrompue :", error instanceof UpstreamError ? `${error.status} ${error.code ?? ""} ${error.message}` : error);
          emit({ type: "error", code: "assistantFailed", message: dict.errors.assistantFailed });
        }
      } finally {
        clearTimeout(timeout);
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      open = false;
      upstream.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Language": locale,
      // Pas de mise en mémoire tampon par un proxy : le texte s'affiche au fil de l'eau.
      "X-Accel-Buffering": "no",
    },
  });
}
