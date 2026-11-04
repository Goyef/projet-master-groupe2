import "server-only";

import type { AssistantConfig } from "./config";

// Client minimal de l'API Responses d'OpenAI (POST /v1/responses, `stream: true`), sans SDK :
// même approche que Resend et Google Agenda, et un faux serveur suffit pour les tests.
// Le flux est au format Server-Sent Events : un objet JSON par événement, dont le champ `type`
// donne la nature (fragment de texte, élément de sortie terminé, réponse finale, erreur).

export type OutputItem = { type: string; [key: string]: unknown };

export type Usage = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  output_tokens?: number;
  output_tokens_details?: { reasoning_tokens?: number };
};

export type ModelTurn = {
  status: "completed" | "incomplete" | "failed";
  output: OutputItem[];
  usage?: Usage;
  incompleteReason?: string;
};

// Refus d'OpenAI : statut HTTP (0 si l'erreur arrive dans le flux), code et paramètre en cause.
export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public param?: string,
  ) {
    super(message);
  }
}

// Ouvre une réponse en flux. Lève UpstreamError si la requête est refusée avant tout flux.
export async function openResponseStream(config: AssistantConfig, body: unknown, signal?: AbortSignal) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let error: { message?: string; code?: string; param?: string; type?: string } = {};
    try {
      error = JSON.parse(text)?.error ?? {};
    } catch {}
    throw new UpstreamError(
      response.status,
      error.message || text.slice(0, 500) || `HTTP ${response.status}`,
      error.code ?? error.type,
      error.param,
    );
  }
  return response.body;
}

// Découpe le flux SSE en événements JSON (lignes « data: », blocs séparés par une ligne vide).
export async function* serverSentEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data || data === "[DONE]") return null;
    try {
      const event = JSON.parse(data);
      return event && typeof event === "object" ? (event as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = parse(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (event) yield event;
      }
      if (done) break;
    }
    const last = parse(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

// Lit un tour complet du modèle : transmet chaque fragment de texte à `onText` et renvoie les
// éléments de sortie (texte, raisonnement chiffré, appels d'outils) à rejouer pour le tour suivant.
export async function readTurn(stream: ReadableStream<Uint8Array>, onText: (text: string) => void): Promise<ModelTurn> {
  const items = new Map<number, OutputItem>();
  let final: Record<string, unknown> | null = null;
  for await (const event of serverSentEvents(stream)) {
    switch (event.type) {
      case "response.output_text.delta":
      case "response.refusal.delta":
        if (typeof event.delta === "string" && event.delta) onText(event.delta);
        break;
      case "response.output_item.done":
        if (event.item && typeof event.item === "object" && typeof event.output_index === "number")
          items.set(event.output_index, event.item as OutputItem);
        break;
      case "response.completed":
      case "response.incomplete":
      case "response.failed":
        final = (event.response as Record<string, unknown>) ?? { status: String(event.type).slice(9) };
        break;
      case "error": {
        const error = (event.error as Record<string, unknown>) ?? event;
        throw new UpstreamError(0, String(error.message ?? "stream error"), error.code as string | undefined);
      }
    }
  }
  // La réponse finale fait foi ; à défaut, les éléments reçus un par un.
  const output = Array.isArray(final?.output) && final.output.length
    ? (final.output as OutputItem[])
    : [...items.entries()].sort(([a], [b]) => a - b).map(([, item]) => item);
  const status = final?.status === "completed" || final?.status === "incomplete" ? final.status : "failed";
  const details = final?.incomplete_details as { reason?: string } | undefined;
  return { status, output, usage: final?.usage as Usage | undefined, incompleteReason: details?.reason };
}
