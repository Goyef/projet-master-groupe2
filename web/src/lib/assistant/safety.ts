// Repère, sans IA, les messages qui évoquent des idées suicidaires ou l'envie de se faire du mal.
// Filet de sécurité : l'encart des numéros d'urgence s'affiche alors toujours dans la conversation,
// quelle que soit la réponse du modèle (qui reçoit aussi la consigne d'en tenir compte).
// Un faux positif est sans gravité (afficher les numéros ne nuit pas) ; la liste reste toutefois
// ciblée pour ne pas réagir aux expressions courantes (« mourir de rire », « en finir avec ce dossier »).

// Minuscules, sans accents, apostrophes et espaces uniformisés.
export function normalizeForMatching(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ");
}

const CRISIS_PATTERNS = [
  // Français et anglais : suicide, suicider, suicidaire, suicidal…
  /suicid/,
  /\b(me|m'|se|s') ?(tuer|pendre|foutre en l'air|jeter (sous|du haut|par la fenetre))\b/,
  /\bmettre fin a (mes|ses|ma|sa) (jours|vie)\b/,
  /\b(envie|besoin|veux|voudrais|vais|aimerais|prefererais) d'en finir\b/,
  /\ben finir avec (la|ma) vie\b/,
  /\b(envie|desir|besoin) de mourir\b/,
  /\b(je )?(veux|voudrais|prefererais) mourir\b/,
  /\b(envie|besoin) de disparaitre\b/,
  /\bplus (aucune )?(envie|raison|force) de vivre\b/,
  /\b(veux|voudrais) plus vivre\b/,
  /\bidees (noires|suicidaires)\b/,
  /\b(me|se) faire du mal\b/,
  /\b(me|se) (scarifier|mutiler|couper les veines)\b/,
  /\b(scarification|automutilation|auto-mutilation)\b/,
  /\boverdose\b/,
  /\bkill(ing)? (myself|herself|himself|themselves)\b/,
  /\bend (my life|my own life|it all)\b/,
  /\b(want|wanna|going|plan|planning) to die\b/,
  /\bself[- ]?harm/,
  /\b(hurt|hurting|cut|cutting|harm|harming) myself\b/,
  /\bno (reason|point) (to live|in living)\b/,
  /\bbetter off dead\b/,
  /\bdon'?t want to (live|be alive|be here anymore)\b/,
];

export function mentionsCrisis(text: string) {
  const normalized = normalizeForMatching(text);
  return CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
}
