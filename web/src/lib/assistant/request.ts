// Validation du corps envoyé à /api/assistant. Module pur (testé sans serveur).
// L'historique vient du navigateur : il n'est jamais tenu pour fiable. Rôles et longueurs sont
// contrôlés, les réponses trop longues tronquées et seuls les messages les plus récents conservés.
import {
  ASSISTANT_HISTORY_MAX,
  ASSISTANT_MESSAGE_MAX,
  ASSISTANT_REPLY_MAX,
  type AssistantMessage,
  type AssistantRequest,
} from "./protocol";

export type AssistantRequestError = { code: "invalidField" | "assistantTooLong"; field: string };

// Coupe un texte sans casser un caractère en deux (émoji, etc.).
export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

// Chemin de la page consultée, sans paramètres ni ancre : un lien de réinitialisation ou de
// désinscription porte un jeton dans son URL, qui ne doit jamais quitter le site.
export function sanitizePage(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.split(/[?#]/)[0].slice(0, 120);
  return /^\/(?!\/)[a-z0-9\-/]*$/i.test(path) ? path : "/";
}

export function parseAssistantRequest(
  body: unknown,
): { ok: true; value: AssistantRequest } | ({ ok: false } & AssistantRequestError) {
  const invalid = (field: string) => ({ ok: false as const, code: "invalidField" as const, field });
  if (!body || typeof body !== "object") return invalid("messages");
  const { messages, page } = body as Record<string, unknown>;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200) return invalid("messages");

  const parsed: AssistantMessage[] = [];
  for (const item of messages.slice(-ASSISTANT_HISTORY_MAX)) {
    if (!item || typeof item !== "object") return invalid("messages");
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return invalid("messages");
    const text = content.trim();
    if (role === "user") {
      if (text.length > ASSISTANT_MESSAGE_MAX) return { ok: false, code: "assistantTooLong", field: "message" };
      if (!text) return invalid("messages");
      parsed.push({ role, content: text });
    } else if (text) {
      // Réponse vide (interrompue avant le premier mot) : ignorée.
      parsed.push({ role, content: clip(text, ASSISTANT_REPLY_MAX) });
    }
  }
  // La conversation se termine toujours par la question à laquelle répondre.
  if (parsed.at(-1)?.role !== "user") return invalid("messages");
  return { ok: true, value: { messages: parsed, page: sanitizePage(page) } };
}
