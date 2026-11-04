import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";

// Rendu des sections sans navigateur ni serveur : TSX compilé à la volée, alias « @/ » vers src/.
const nodeRequire = createRequire(import.meta.url);
const modules = new Map();
function resolveFile(base) {
  const found = [`${base}.ts`, `${base}.tsx`, base].find((candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate));
  if (!found) throw new Error(`Module introuvable : ${base}`);
  return found;
}
function load(path) {
  const filename = resolveFile(resolve(path));
  if (modules.has(filename)) return modules.get(filename);
  const compiled = { exports: {} };
  modules.set(filename, compiled.exports);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  const require = (specifier) => {
    if (specifier.startsWith("@/")) return load(resolve("src", specifier.slice(2)));
    if (specifier.startsWith(".")) return load(resolve(dirname(filename), specifier));
    return nodeRequire(specifier);
  };
  new Function("module", "exports", "require", outputText)(compiled, compiled.exports, require);
  modules.set(filename, compiled.exports);
  return compiled.exports;
}

const { createElement } = nodeRequire("react");
const { renderToStaticMarkup } = nodeRequire("react-dom/server");
const { Testimonials } = load("src/components/sections/testimonials.tsx");
const { seminarIntention, INTENTION_MAX } = load("src/components/seminars/seminar-prefill.ts");
const { texts: fr } = load("src/content/texts.ts");
const { english: en } = load("src/content/en.ts");

// Données factices, uniquement pour ce test : aucun témoignage réel n'est inventé dans les dictionnaires.
const fake = [
  { quote: "Citation factice <b>échappée</b>", author: "A. B.", context: "Accompagnement de 3 mois" },
  { quote: "Deuxième citation factice", author: "C." },
];

test("témoignages : section masquée sans données, affichée avec des données", () => {
  for (const dict of [fr, en]) {
    for (const items of [dict.testimonials.coaching, dict.testimonials.companies]) {
      assert.ok(Array.isArray(items));
    }
    assert.equal(renderToStaticMarkup(createElement(Testimonials, { eyebrow: "x", title: dict.testimonials.title, items: [] })), "");
  }
  const html = renderToStaticMarkup(createElement(Testimonials, {
    id: "temoignages", eyebrow: fr.testimonials.eyebrow, title: fr.testimonials.title, items: fake,
  }));
  assert.match(html, /<section id="temoignages" aria-labelledby="temoignages-titre"/);
  assert.ok(html.includes(fr.testimonials.title));
  assert.equal(html.match(/<figure/g)?.length, 2);
  assert.equal(html.match(/<blockquote/g)?.length, 2);
  assert.ok(html.includes("&lt;b&gt;échappée&lt;/b&gt;"), "citation échappée");
  assert.ok(html.includes("Accompagnement de 3 mois"));
  assert.ok(html.includes(">C.</span>"));
});

test("configurateur : récapitulatif lisible, coupé à la limite du champ", () => {
  const summary = { size: fr.seminars.builder.sizes[1], topics: "PNL, MBTI", format: fr.seminars.builder.formats[0].title, goal: "" };
  const text = seminarIntention(fr.seminars.builder, summary);
  assert.deepEqual(text.split("\n"), [
    fr.seminars.builder.prefillTitle,
    `Équipe : ${summary.size}`,
    "Thèmes : PNL, MBTI",
    `Format : ${summary.format}`,
  ]);
  const english = seminarIntention(en.seminars.builder, { ...summary, goal: "Better meetings" });
  assert.ok(english.endsWith("\nGoal: Better meetings"));
  assert.equal(seminarIntention(fr.seminars.builder, { ...summary, goal: "x".repeat(2000) }).length, INTENTION_MAX);
});
