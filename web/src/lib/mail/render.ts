import "server-only";

import type { Texts } from "@/content/texts";
import { format } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

// Mise en page des e-mails : HTML compatible avec les messageries (tableaux, styles en ligne,
// pas de CSS externe ni de police web) et version texte brut, construites à partir des mêmes blocs.
// Toute valeur est échappée : un nom ou un message saisi sur le site ne peut pas injecter de HTML.

export type MailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "details"; rows: [label: string, value: string][] }
  // `fallback` : afficher aussi le lien en clair sous le bouton (liens importants seulement).
  | { kind: "button"; label: string; url: string; fallback?: boolean }
  | { kind: "quote"; text: string }
  | { kind: "note"; text: string };

type MailContent = {
  dict: Texts["emails"];
  locale: Locale;
  site: string;
  title: string;
  // Prénom et nom du destinataire, pour la formule d'appel (absent : pas de formule).
  name?: string;
  // Notification adressée au gérant : ni signature ni invitation à répondre.
  internal?: boolean;
  blocks: MailBlock[];
};

// Couleurs de la marque (identiques à globals.css), en dur : les messageries ignorent les variables CSS.
const NAVY = "#0A1D35";
const IVORY = "#F2E8DC";
const CARD = "#FFFDF9";
const MUTED = "#4A5A6E";
const LINE = "#DCCDB9";
const DIAMOND = "#D0E7F5";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Texte échappé, retours à la ligne conservés.
const html = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

function blockHtml(block: MailBlock, dict: Texts["emails"]) {
  switch (block.kind) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${NAVY}">${html(block.text)}</p>`;
    case "note":
      return `<p style="margin:0 0 16px;font:14px/1.6 ${SANS};color:${MUTED}">${html(block.text)}</p>`;
    case "quote":
      return `<div style="margin:0 0 20px;padding:14px 18px;border-left:3px solid ${NAVY};background:${DIAMOND};font:15px/1.6 ${SANS};color:${NAVY}">${html(block.text)}</div>`;
    case "details":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${LINE};border-radius:8px;border-collapse:separate;background:${IVORY}">${block.rows
        .map(
          ([label, value], index) =>
            `<tr><td style="padding:10px 16px;${index ? `border-top:1px solid ${LINE};` : ""}font:13px/1.4 ${SANS};color:${MUTED};width:35%;vertical-align:top">${html(label)}</td><td style="padding:10px 16px;${index ? `border-top:1px solid ${LINE};` : ""}font:bold 15px/1.4 ${SANS};color:${NAVY}">${html(value)}</td></tr>`,
        )
        .join("")}</table>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 ${block.fallback ? 12 : 20}px"><tr><td style="border-radius:8px;background:${NAVY}"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:13px 22px;font:bold 15px ${SANS};color:${IVORY};text-decoration:none;border-radius:8px">${html(block.label)}</a></td></tr></table>${
        block.fallback
          ? `<p style="margin:0 0 20px;font:12px/1.5 ${SANS};color:${MUTED}">${html(dict.buttonFallback)}<br><a href="${escapeHtml(block.url)}" style="color:${MUTED};word-break:break-all">${html(block.url)}</a></p>`
          : ""
      }`;
  }
}

// Deux-points : espace avant en français (« Date : … »), pas en anglais (« Date: … »).
function blockText(block: MailBlock, locale: Locale) {
  const colon = locale === "fr" ? " : " : ": ";
  switch (block.kind) {
    case "paragraph":
    case "note":
      return block.text;
    case "quote":
      return block.text
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n");
    case "details":
      return block.rows.map(([label, value]) => `${label}${colon}${value}`).join("\n");
    case "button":
      return `${block.label}${colon}${block.url}`;
  }
}

export function renderMail({ dict, locale, site, title, name, blocks, internal = false }: MailContent) {
  const footer = internal ? dict.adminFooter : dict.footer;
  const greeting = name ? format(dict.greeting, { name }) : null;
  // Aperçu affiché par la messagerie à côté de l'objet.
  const preview = blocks.find((block) => block.kind === "paragraph")?.text ?? title;
  const body = [
    greeting && `<p style="margin:0 0 16px;font:16px/1.6 ${SANS};color:${NAVY}">${html(greeting)}</p>`,
    ...blocks.map((block) => blockHtml(block, dict)),
    !internal &&
      `<p style="margin:24px 0 0;font:16px/1.6 ${SANS};color:${NAVY}">${html(dict.signature)}<br><strong>${html(dict.signatureName)}</strong></p>`,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlMail = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${html(title)}</title>
</head>
<body style="margin:0;padding:0;background:${IVORY}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${html(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 0 20px">
<a href="${escapeHtml(site)}" style="text-decoration:none">
<img src="${escapeHtml(site)}/brand/logo.png" width="44" height="44" alt="" style="vertical-align:middle;border:0;border-radius:50%">
<span style="vertical-align:middle;margin-left:10px;font:bold 22px ${SERIF};color:${NAVY}">Synégo</span>
</a>
</td></tr>
<tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:14px;padding:32px 28px">
<h1 style="margin:0 0 20px;font:600 26px/1.25 ${SERIF};color:${NAVY}">${html(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 8px 0;font:12px/1.6 ${SANS};color:${MUTED}">${html(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textMail = [
    title,
    "",
    ...(greeting ? [greeting, ""] : []),
    ...blocks.flatMap((block) => [blockText(block, locale), ""]),
    ...(internal ? [] : [dict.signature, dict.signatureName, ""]),
    "—",
    footer,
  ].join("\n");

  return { html: htmlMail, text: textMail };
}
