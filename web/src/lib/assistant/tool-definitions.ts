// Outils (« function calling ») proposés au modèle, au format de l'API Responses d'OpenAI.
// Mode strict : chaque objet déclare `additionalProperties: false` et liste toutes ses propriétés
// dans `required` (les facultatives acceptent `null`) ; un schéma non conforme serait refusé par l'API.
// Module pur : le test vérifie ces règles sans appeler OpenAI. L'exécution est dans tools.ts.

export const TOOL_SLOTS = "get_available_slots";
export const TOOL_BOOKING = "propose_booking";
export const TOOL_CRISIS = "show_crisis_resources";

export const assistantTools = [
  {
    type: "function",
    name: TOOL_SLOTS,
    description:
      "Renvoie les prochains créneaux libres, en heure de Paris, pour un type de rendez-vous, regroupés par jour. " +
      "À appeler dès que l'utilisateur demande des disponibilités, un horaire, une date ou « le plus tôt possible ». " +
      "Ne jamais deviner un créneau sans cet outil.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: ["vente", "audit", "suivi"],
          description:
            "vente = appel découverte (45 min, ouvert à tous) ; audit = audit séminaire pour une entreprise (45 min) ; " +
            "suivi = séance de suivi (1 h), réservée aux clients connectés.",
        },
        from_date: {
          type: ["string", "null"],
          description:
            "Premier jour souhaité au format AAAA-MM-JJ (date de Paris), ou null pour les prochains créneaux dès maintenant.",
        },
      },
      required: ["appointment_type", "from_date"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: TOOL_BOOKING,
    description:
      "Affiche sous ta réponse une carte qui ouvre la page de réservation avec le type de rendez-vous présélectionné " +
      "et, si l'utilisateur l'accepte, un court résumé de sa demande prérempli dans le champ « Ce qui vous amène » " +
      "(qu'il relit et modifie avant d'envoyer ; rien n'est réservé ni transmis à Youcef par cet outil). " +
      "À appeler quand l'utilisateur veut réserver un appel découverte ou un audit séminaire, ou accepte ta proposition.",
    parameters: {
      type: "object",
      properties: {
        appointment_type: {
          type: "string",
          enum: ["vente", "audit"],
          description: "vente = appel découverte (accompagnement individuel) ; audit = audit séminaire (entreprise).",
        },
        intention: {
          type: "string",
          description:
            "Résumé à la première personne, en une à trois phrases et dans la langue de l'utilisateur, de ce qu'il a " +
            "exprimé (ou du projet de séminaire). Chaîne vide si l'utilisateur n'a rien partagé ou ne souhaite pas de résumé. " +
            "Jamais de diagnostic ni d'information qu'il n'a pas donnée ; 600 caractères au plus.",
        },
      },
      required: ["appointment_type", "intention"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: TOOL_CRISIS,
    description:
      "Affiche dans la conversation l'encart des numéros d'urgence (3114, 15, 112) avec des liens d'appel. " +
      "À appeler dès que l'utilisateur évoque des idées suicidaires, l'envie de se faire du mal, un danger immédiat " +
      "ou une détresse aiguë.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
] as const;
