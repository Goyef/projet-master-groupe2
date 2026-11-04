// Contrat d'échange entre le widget de l'assistant (navigateur) et la route /api/assistant.
// Module pur, partagé par le client et le serveur : aucune dépendance au serveur ici.

// Caractères au plus par message de l'utilisateur (vérifié côté serveur et dans le champ de saisie).
export const ASSISTANT_MESSAGE_MAX = 1000;
// Longueur au plus d'une réponse de l'assistant renvoyée dans l'historique (au-delà : tronquée).
export const ASSISTANT_REPLY_MAX = 6000;
// Messages transmis au plus à chaque requête : les plus récents (la fin de la conversation).
export const ASSISTANT_HISTORY_MAX = 20;
// Clé sessionStorage de la conversation : elle disparaît avec l'onglet, jamais envoyée au serveur telle quelle.
export const ASSISTANT_STORAGE_KEY = "synego:assistant";

export type AssistantRole = "user" | "assistant";
export type AssistantMessage = { role: AssistantRole; content: string };

// Types de rendez-vous que l'assistant peut préremplir (contrat de src/lib/booking-prefill.ts).
export type BookableType = "vente" | "audit";

// Éléments d'interface affichés dans la conversation à la demande de l'assistant (ou du serveur).
export type AssistantAction =
  | { kind: "booking"; appointmentType: BookableType; intention: string }
  | { kind: "crisis" };

// Réponse de /api/assistant : une ligne JSON par événement (application/x-ndjson).
export type AssistantEvent =
  // Un outil est en cours d'exécution (consultation des créneaux…).
  | { type: "status"; status: "slots" }
  | { type: "delta"; text: string }
  | { type: "action"; action: AssistantAction }
  // `incomplete` : réponse coupée (limite de longueur atteinte).
  | { type: "done"; incomplete?: boolean }
  | { type: "error"; code: string; message: string };

// Corps de la requête envoyée par le widget.
export type AssistantRequest = { messages: AssistantMessage[]; page: string };
