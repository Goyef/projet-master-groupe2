import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import ts from "typescript";

// Questionnaire d'auto-évaluation, préremplissage de la réservation et ressources d'urgence.
// Lancer après `pnpm build` ; aucune base n'est nécessaire.

// Charge les modules purs avec le compilateur du projet (même méthode que i18n.test.mjs).
const modules = new Map();
function source(path, globals = {}) {
  const filename = resolve(path);
  if (modules.has(filename)) return modules.get(filename);
  const compiled = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const require = (relative) => source(resolve(dirname(filename), relative + ".ts"));
  new Function("module", "exports", "require", ...Object.keys(globals), outputText)(compiled, compiled.exports, require, ...Object.values(globals));
  modules.set(filename, compiled.exports);
  return compiled.exports;
}

const { texts: fr } = source("src/content/texts.ts");
const { english: en } = source("src/content/en.ts");
const { quizTier, quizSummary, QUIZ_SCALE_MAX } = source("src/lib/quiz.ts");

// sessionStorage simulé, pour vérifier la lecture unique et la tolérance aux erreurs.
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const prefill = source("src/lib/booking-prefill.ts", { sessionStorage: storage });

test("paliers du questionnaire", () => {
  const count = fr.quiz.questions.length;
  assert.equal(count, 10);
  assert.equal(fr.quiz.scale.length, QUIZ_SCALE_MAX + 1);
  const answers = (total) => Array.from({ length: count }, (_, index) => Math.max(0, Math.min(QUIZ_SCALE_MAX, total - index * QUIZ_SCALE_MAX)));
  assert.equal(quizTier(Array(count).fill(0)), "low");
  assert.equal(quizTier(answers(9)), "low");
  assert.equal(quizTier(answers(10)), "medium");
  assert.equal(quizTier(answers(19)), "medium");
  assert.equal(quizTier(answers(20)), "high");
  assert.equal(quizTier(Array(count).fill(QUIZ_SCALE_MAX)), "high");
});

test("résumé joint : lisible, traduit et sous la limite du serveur", () => {
  for (const dict of [fr, en]) {
    const longest = Array(dict.quiz.questions.length).fill(QUIZ_SCALE_MAX);
    const summary = quizSummary(dict.quiz, longest);
    assert.ok(summary.length <= prefill.INTENTION_MAX_LENGTH, `${summary.length} caractères`);
    assert.ok(summary.startsWith(dict.quiz.summaryTitle));
    assert.ok(summary.includes(dict.quiz.questions[0].short));
    assert.ok(summary.includes(dict.quiz.scale[QUIZ_SCALE_MAX].toLowerCase()));
    assert.ok(summary.includes(dict.quiz.tiers.high.title));
    assert.ok(!/\{\w+\}/.test(summary), "variables remplacées");
  }
});

test("contrat de préremplissage : validation, troncature et lecture unique", () => {
  const { BOOKING_PREFILL_KEY, parseBookingPrefill, saveBookingPrefill, takeBookingPrefill, INTENTION_MAX_LENGTH } = prefill;
  assert.equal(BOOKING_PREFILL_KEY, "synego:booking-prefill");
  assert.deepEqual(parseBookingPrefill('{"type":"audit","intention":"Séminaire"}'), { type: "audit", intention: "Séminaire" });
  assert.deepEqual(parseBookingPrefill('{"intention":"Bonjour"}'), { intention: "Bonjour" });
  for (const invalid of [null, "", "{", "null", "[]", '{"type":"suivi","intention":"x"}', '{"type":"vente"}', '{"intention":3}'])
    assert.equal(parseBookingPrefill(invalid), null, String(invalid));
  const long = parseBookingPrefill(JSON.stringify({ intention: "a".repeat(INTENTION_MAX_LENGTH - 1) + "😀" + "b" }));
  assert.equal(long.intention.length, INTENTION_MAX_LENGTH - 1, "émoji coupé retiré");

  assert.ok(saveBookingPrefill({ type: "vente", intention: "Résumé" }));
  assert.deepEqual(JSON.parse(values.get(BOOKING_PREFILL_KEY)), { type: "vente", intention: "Résumé" });
  assert.deepEqual(takeBookingPrefill(), { type: "vente", intention: "Résumé" });
  assert.equal(values.has(BOOKING_PREFILL_KEY), false, "clé supprimée après lecture");
  assert.equal(takeBookingPrefill(), null);

  // Stockage indisponible (navigation privée, blocage) : aucune exception.
  storage.getItem = storage.setItem = () => { throw new Error("Stockage indisponible"); };
  assert.equal(saveBookingPrefill({ intention: "x" }), false);
  assert.equal(takeBookingPrefill(), null);
});

test("page /auto-evaluation et ressources d'urgence, en français et en anglais", { timeout: 60000 }, async (t) => {
  const port = Number(process.env.TEST_PORT) || 43131;
  const origin = `http://127.0.0.1:${port}`;
  // Aucun accès à une vraie base, même si .env.local en définit une.
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: {
      ...process.env, NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
      DATABASE_URL_UNPOOLED: "", ADMIN_EMAIL: "", ADMIN_PASSWORD: "",
    },
    stdio: "pipe",
  });
  let logs = "";
  server.stdout.on("data", (data) => logs += data);
  server.stderr.on("data", (data) => logs += data);
  t.after(() => server.kill());
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) assert.fail(logs);
    try { ready = (await fetch(origin + "/flags/fr.svg")).ok; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, logs);

  const decode = (html) => html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  for (const [locale, dict] of [["fr", fr], ["en", en]]) {
    const headers = { Cookie: `synego-locale=${locale}` };
    const quiz = await fetch(origin + "/auto-evaluation", { headers });
    assert.equal(quiz.status, 200);
    const html = decode(await quiz.text());
    assert.ok(html.includes(`<html lang="${locale}"`));
    assert.ok(html.includes(dict.quiz.title), `${locale}: titre`);
    assert.ok(html.includes(dict.quiz.questions[0].text), `${locale}: première question`);
    assert.ok(html.includes(dict.quiz.privacy), `${locale}: mention de confidentialité`);
    assert.ok(html.includes('role="progressbar"'), `${locale}: barre de progression`);

    // Pied de page de toutes les pages : 3114, 15 et 112 cliquables.
    for (const path of ["/", "/rendez-vous", "/auto-evaluation"]) {
      const page = decode(await (await fetch(origin + path, { headers })).text());
      for (const number of ["3114", "15", "112"]) assert.ok(page.includes(`href="tel:${number}"`), `${locale}${path}: tel:${number}`);
      assert.ok(page.includes(dict.crisis.title), `${locale}${path}: encart d'urgence`);
      assert.ok(page.includes('href="/auto-evaluation"'), `${locale}${path}: lien vers le questionnaire`);
    }
    if (locale === "en") assert.match(dict.crisis.distress + dict.crisis.emergency, /in France/);
  }
});
