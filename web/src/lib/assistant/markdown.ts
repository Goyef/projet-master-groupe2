// Markdown minimal et sûr pour les réponses de l'assistant : paragraphes, listes, gras, italique,
// code et liens. Aucun HTML n'est interprété (React échappe le texte) et seuls les liens internes
// (/…, #…), https:, mailto: et tel: sont conservés ; tout autre lien devient du texte.
// Module pur, testé sans navigateur. Pas de « lookbehind » dans les expressions régulières :
// elles doivent rester compatibles avec les anciens Safari.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; internal: boolean; children: Inline[] }
  | { type: "break" };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] };

export function safeHref(href: string): { href: string; internal: boolean } | null {
  const value = href.trim();
  if (/^\/(?!\/)/.test(value) || /^#[\w-]*$/.test(value)) return { href: value, internal: true };
  if (/^https:\/\/[^\s]+$/i.test(value) || /^(mailto|tel):[^\s]+$/i.test(value)) return { href: value, internal: false };
  return null;
}

// Code, lien, gras, italique (précédé d'un début de texte, d'une espace ou d'une ponctuation
// ouvrante), adresse https nue, retour à la ligne.
const INLINE =
  /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(?!\s)([^*\n]+?)\*\*|(^|[\s(«"“'])\*(?![\s*])([^*\n]+?)\*(?![\w*])|(https:\/\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"»])|\n/g;

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  const push = (node: Inline) => {
    const previous = nodes.at(-1);
    if (node.type === "text" && previous?.type === "text") previous.text += node.text;
    else if (node.type !== "text" || node.text) nodes.push(node);
  };
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    push({ type: "text", text: text.slice(last, index) });
    const [whole, code, label, href, strong, emPrefix, em, url] = match;
    if (code !== undefined) push({ type: "code", text: code });
    else if (label !== undefined) {
      const safe = safeHref(href);
      if (safe) push({ type: "link", ...safe, children: parseInline(label) });
      else push({ type: "text", text: label });
    } else if (strong !== undefined) push({ type: "strong", children: parseInline(strong) });
    else if (em !== undefined) {
      push({ type: "text", text: emPrefix ?? "" });
      push({ type: "em", children: parseInline(em) });
    } else if (url !== undefined) push({ type: "link", href: url, internal: false, children: [{ type: "text", text: url }] });
    else push({ type: "break" });
    last = index + whole.length;
  }
  push({ type: "text", text: text.slice(last) });
  return nodes;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, start: list.start, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      list.items.push(bullet ? bullet[1] : (numbered as RegExpExecArray)[2]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    // Ligne indentée sous un élément de liste : suite de cet élément.
    if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    // Titre éventuel : rendu comme une ligne en gras (les consignes demandent d'éviter les titres).
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "paragraph", children: [{ type: "strong", children: parseInline(heading[1]) }] });
      continue;
    }
    paragraph.push(line.replace(/^>\s?/, ""));
  }
  flushParagraph();
  flushList();
  return blocks;
}
