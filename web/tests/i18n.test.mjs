import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import ts from "typescript";

// Charge les modules purs avec le compilateur du projet, aussi sous Node 20.
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

const { negotiateLocale } = source("src/lib/i18n.ts");
const { formatDateTime } = source("src/lib/format.ts");
const { texts: fr } = source("src/content/texts.ts");
const { english: en } = source("src/content/en.ts");

test("dictionnaires complets, avec les mêmes variables et listes", () => {
  function compare(left, right, path = "texts") {
    assert.equal(typeof right, typeof left, path);
    if (typeof left === "string") {
      assert.ok(right.trim(), path);
      assert.deepEqual(right.match(/\{\w+\}/g)?.sort(), left.match(/\{\w+\}/g)?.sort(), path);
      return;
    }
    assert.deepEqual(Object.keys(right).sort(), Object.keys(left).sort(), path);
    for (const key of Object.keys(left)) compare(left[key], right[key], `${path}.${key}`);
  }
  compare(fr, en);
});

test("priorités du navigateur et variantes régionales", () => {
  for (const [header, expected] of [
    [null, "fr"], ["", "fr"], ["de, en-GB;q=0.9, fr;q=0.8", "en"],
    ["en;q=0.3, fr-CA;q=0.9", "fr"], ["EN-US", "en"],
    ["en;q=0, fr;q=0.5", "fr"], ["en;q=invalid,fr", "fr"],
    ["de, *;q=0.8", "fr"], ["fr;q=0, en;q=1", "en"],
  ]) assert.equal(negotiateLocale(header), expected, String(header));
});

test("dates traduites, toujours à l'heure de Paris", () => {
  const winter = new Date("2026-01-12T14:30:00Z");
  const summer = new Date("2026-07-13T14:30:00Z");
  assert.match(formatDateTime(winter, "fr"), /lundi 12 janvier 2026.*15:30/);
  assert.match(formatDateTime(winter, "en"), /Monday, 12 January 2026.*15:30/);
  assert.match(formatDateTime(summer, "en"), /Monday, 13 July 2026.*16:30/);
});

test("thème et mode restaurés après un changement de langue, même sans stockage", () => {
  const classes = new Set();
  const root = {
    dataset: { theme: "classique" }, style: {},
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
    },
  };
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const appearance = source("src/lib/theme.ts", { document: { documentElement: root }, localStorage: storage });
  for (const theme of ["elegant", "moderne", "classique"]) {
    for (const mode of ["dark", "light"]) {
      appearance.applyAppearance(theme, mode);
      root.dataset.theme = "classique";
      classes.clear();
      appearance.restoreAppearance();
      assert.deepEqual(appearance.readAppearance(), { theme, mode });
      assert.equal(root.style.colorScheme, mode);
    }
  }
  storage.getItem = storage.setItem = () => { throw new Error("Stockage indisponible"); };
  appearance.applyAppearance("moderne", "dark");
  root.dataset.theme = "classique";
  classes.clear();
  appearance.restoreAppearance();
  assert.deepEqual(appearance.readAppearance(), { theme: "moderne", mode: "dark" });
});

test("URL sans préfixe, préférence de langue et erreurs API", { timeout: 60000 }, async (t) => {
  const port = Number(process.env.I18N_TEST_PORT) || 43128;
  const origin = `http://127.0.0.1:${port}`;
  // Aucun accès à la base de développement, même si .env.local définit une URL directe.
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: {
      ...process.env, NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
      DATABASE_URL_UNPOOLED: "", ADMIN_EMAIL: "", ADMIN_PASSWORD: "",
      // Sans clé OpenAI, l'assistant est désactivé (voir tests/assistant.test.mjs pour son fonctionnement).
      OPENAI_API_KEY: "",
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

  for (const [locale, dict] of [["fr", fr], ["en", en]]) {
    const headers = { Cookie: `synego-locale=${locale}`, "Accept-Language": locale === "fr" ? "en" : "fr" };
    for (const [path, heading] of [
      ["", dict.home.title], ["/seminaires", dict.seminars.title],
      ["/rendez-vous", dict.booking.title], ["/connexion", dict.portal.loginTitle],
      ["/mentions-legales", dict.legal.noticeTitle], ["/confidentialite", dict.legal.privacyTitle],
    ]) {
      const response = await fetch(origin + (path || "/"), { headers, redirect: "manual" });
      const html = await response.text();
      assert.equal(response.status, 200, `${locale}${path}: ${response.headers.get("location") ?? html.slice(0,100)}`);
      assert.ok(html.includes(`<html lang="${locale}"`), `${locale}${path}: langue HTML`);
      assert.ok(html.includes(heading), `${locale}${path}: titre traduit`);
      assert.ok(html.includes('href="/connexion"'), `${locale}${path}: navigation sans préfixe`);
      assert.ok(!html.includes(`href="/${locale}/`), `${locale}${path}: aucun lien préfixé`);
      assert.ok(html.includes(`content="${locale === "fr" ? "fr_FR" : "en_GB"}"`));
    }
    // Vidéo de présentation sous l'accroche, dans la langue de la page (fichier et affiche), titre traduit.
    const homePage = await (await fetch(origin + "/", { headers })).text();
    const promo = locale === "fr" ? "synego-promo" : "synego-promo-en";
    const other = locale === "fr" ? "synego-promo-en" : "synego-promo";
    assert.ok(homePage.includes(`src="/video/${promo}.mp4"`), `${locale}: vidéo de l'accueil dans la langue de la page`);
    assert.ok(!homePage.includes(`/video/${other}.mp4`), `${locale}: pas de vidéo dans l'autre langue`);
    assert.ok(homePage.includes(dict.home.videoTitle), `${locale}: titre de la vidéo`);
    assert.match(homePage, new RegExp(`<video[^>]+poster="[^"]+${promo}-poster[^"]*\\.webp"`), `${locale}: affiche de la vidéo`);
    assert.equal((await fetch(`${origin}/video/${promo}.mp4`)).status, 200, `${promo}.mp4 servi`);
    const missing = await fetch(`${origin}/page-inexistante`, { headers });
    assert.equal(missing.status, 404);
    assert.ok((await missing.text()).includes(dict.common.notFoundTitle));
    const account = await fetch(`${origin}/espace-client`, { headers, redirect: "manual" });
    assert.equal(account.status, 307);
    assert.equal(new URL(account.headers.get("location"), origin).pathname, "/connexion");

    const error = await fetch(origin + "/api/portal?action=slots&type=suivi", { headers: { "Accept-Language": locale } });
    assert.equal(error.status, 401);
    assert.equal(error.headers.get("content-language"), locale);
    assert.deepEqual(await error.json(), { error: dict.errors.clientRequired, code: "clientRequired" });
    const refused = await fetch(origin + "/api/portal", { method: "POST", headers: { Origin: "https://other.test", "Accept-Language": locale } });
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error, dict.errors.originRefused);

    // Assistant désactivé sans OPENAI_API_KEY : ni bouton, ni réponse de l'API.
    const home = await (await fetch(origin + "/", { headers })).text();
    assert.ok(!home.includes(dict.assistant.launcherLabel), `${locale}: pas de bouton d'assistant sans clé`);
    const assistant = await fetch(origin + "/api/assistant", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "Accept-Language": locale },
      body: JSON.stringify({ messages: [{ role: "user", content: "Bonjour" }], page: "/" }),
    });
    assert.equal(assistant.status, 503);
    assert.deepEqual(await assistant.json(), { error: dict.errors.assistantUnavailable, code: "assistantUnavailable" });
  }
  for (const [headers, locale] of [
    [{ "Accept-Language": "en-GB,en;q=0.9,fr;q=0.8" }, "en"],
    [{ "Accept-Language": "en", Cookie: "synego-locale=fr" }, "fr"],
    [{ "Accept-Language": "fr", Cookie: "synego-locale=en" }, "en"],
    [{ "Accept-Language": "en", Cookie: "synego-locale=invalid" }, "en"],
  ]) {
    const response = await fetch(origin + "/rendez-vous?type=audit", { headers, redirect: "manual" });
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).pathname + new URL(response.url).search, "/rendez-vous?type=audit");
    assert.ok((await response.text()).includes(`<html lang="${locale}"`));
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  assert.equal((await fetch(origin + "/de")).status, 404);
  assert.equal((await fetch(origin + "/flags/en.svg")).status, 200);
});
