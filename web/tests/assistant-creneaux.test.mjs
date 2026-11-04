import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

// Assistant avec une vraie base (temporaire) : créneaux lus par l'outil get_available_slots,
// règles d'accès au suivi selon le compte, aucune donnée personnelle envoyée à OpenAI, et
// compteur de débit en base (empreinte de l'adresse IP, jamais l'adresse elle-même).
// Le flux, les autres outils et la sécurité sont testés sans base dans tests/assistant.test.mjs.

// Base Postgres d'administration : celle de docker-compose.yml par défaut.
const adminUrl = process.env.TEST_DATABASE_URL || "postgres://synego:synego@localhost:5432/synego";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parisDay = (time) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(time);
const parisTime = (time) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(time);

let sequence = 0;
function events(output, extra = []) {
  const id = ++sequence;
  return [
    { type: "response.created", response: { id: `resp_${id}`, status: "in_progress", output: [] } },
    ...extra,
    ...output.map((item, index) => ({ type: "response.output_item.done", output_index: index, item })),
    { type: "response.completed", response: { id: `resp_${id}`, status: "completed", output, usage: { input_tokens: 100, output_tokens: 10 } } },
  ];
}
const textTurn = (text) => {
  const item = { id: `msg_${++sequence}`, type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] };
  return events([item], [{ type: "response.output_text.delta", item_id: item.id, output_index: 0, content_index: 0, delta: text }]);
};
const slotsCall = (args) =>
  events([{ id: `fc_${++sequence}`, type: "function_call", status: "completed", call_id: `call_${sequence}`, name: "get_available_slots", arguments: JSON.stringify(args) }]);
const toolOutput = (body) => {
  const output = body.input.find((item) => item.type === "function_call_output");
  return output ? JSON.parse(output.output) : null;
};

test("assistant : créneaux réels, accès au suivi et compteur de débit en base", { timeout: 90000 }, async () => {
  const database = "synego_test_" + randomBytes(6).toString("hex");
  const maintenance = new pg.Client({ connectionString: adminUrl });
  await maintenance.connect();
  await maintenance.query(`CREATE DATABASE ${database}`);
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = "/" + database;
  const password = randomBytes(20).toString("hex");
  const port = Number(process.env.TEST_PORT) || 43127;
  const origin = `http://127.0.0.1:${port}`;

  // Faux OpenAI : appel de l'outil de créneaux avec les arguments du test, puis texte.
  const apiKey = "sk-test-" + randomBytes(12).toString("hex");
  const requests = [];
  let slotArguments = null;
  const openai = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.headers.authorization !== `Bearer ${apiKey}`) {
      res.writeHead(401);
      return res.end();
    }
    const parsed = JSON.parse(body);
    requests.push(parsed);
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const turn = slotArguments && !toolOutput(parsed) ? slotsCall(slotArguments) : textTurn("Voici les créneaux.");
    for (const event of turn) res.write(`data: ${JSON.stringify(event)}\n\n`);
    res.end();
  });
  await new Promise((resolve) => openai.listen(0, "127.0.0.1", resolve));

  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: databaseUrl.toString(),
      DATABASE_URL_UNPOOLED: databaseUrl.toString(),
      ADMIN_EMAIL: "gerant@example.test",
      ADMIN_PASSWORD: password,
      RESEND_API_KEY: "",
      OPENAI_API_KEY: apiKey,
      OPENAI_API_URL: `http://127.0.0.1:${openai.address().port}/v1/responses`,
      ASSISTANT_DAILY_LIMIT: "",
    },
    stdio: "pipe",
  });
  let logs = "";
  server.stdout.on("data", (data) => (logs += data));
  server.stderr.on("data", (data) => (logs += data));

  async function portal(data, cookie = "") {
    const response = await fetch(origin + "/api/portal", {
      method: "POST",
      headers: { Origin: origin, "Accept-Language": "fr", "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    return { response, data: await response.json() };
  }
  async function ask(content, { cookie = "", ip = "192.0.2.10" } = {}) {
    const response = await fetch(origin + "/api/assistant", {
      method: "POST",
      headers: {
        Origin: origin,
        "Accept-Language": "fr",
        "Content-Type": "application/json",
        "X-Real-IP": ip,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({ messages: [{ role: "user", content }], page: "/rendez-vous" }),
    });
    const text = await response.text();
    return { response, events: response.ok ? text.split("\n").filter(Boolean).map((line) => JSON.parse(line)) : JSON.parse(text) };
  }
  const sessionOf = (result) => result.response.headers.get("set-cookie").split(";")[0];

  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      await pause(100);
    }

    // Le gérant ouvre deux créneaux d'une heure dans deux jours (valables pour tous les rendez-vous).
    const admin = sessionOf(await portal({ action: "login", email: "gerant@example.test", password }));
    const starts = Math.ceil((Date.now() + 2 * 86400_000) / 3600_000) * 3600_000;
    const added = await portal({ action: "add-slot", starts, ends: starts + 2 * 3600_000, minutes: 60 }, admin);
    assert.equal(added.response.status, 200, logs);
    const expected = { date: parisDay(starts), times: [parisTime(starts), parisTime(starts + 3600_000)] };

    // Visiteur : créneaux d'un appel découverte, regroupés par jour en heure de Paris.
    slotArguments = { appointment_type: "vente", from_date: null };
    const visitor = await ask("Quels sont vos prochains créneaux ?");
    assert.equal(visitor.response.status, 200, logs);
    assert.deepEqual(visitor.events[0], { type: "status", status: "slots" });
    const slots = toolOutput(requests.at(-1));
    assert.equal(slots.total_available, 2);
    assert.equal(slots.duration_minutes, 45);
    assert.equal(slots.booking_page, "/rendez-vous");
    assert.deepEqual({ date: slots.days[0].date, times: slots.days[0].times }, expected);
    assert.match(slots.days[0].label, /\d{4}/);

    // À partir d'une date sans créneau : aucun, et la liste d'attente est suggérée.
    slotArguments = { appointment_type: "vente", from_date: parisDay(starts + 3 * 86400_000) };
    await ask("Et la semaine suivante ?");
    const later = toolOutput(requests.at(-1));
    assert.equal(later.total_available, 0);
    assert.match(later.note, /Prévenez-moi si un créneau se libère/);

    // Suivi : refusé au visiteur, proposé au client connecté (créneaux d'une heure).
    slotArguments = { appointment_type: "suivi", from_date: null };
    await ask("Et pour une séance de suivi ?");
    assert.equal(toolOutput(requests.at(-1)).error, "client_account_required");
    const registered = await portal({
      action: "register",
      name: "Camille Test",
      email: "camille@example.test",
      phone: "06 11 22 33 44",
      password,
      consent: true,
    });
    const client = sessionOf(registered);
    await ask("Et pour une séance de suivi ?", { cookie: client });
    const followUp = toolOutput(requests.at(-1));
    assert.equal(followUp.total_available, 2);
    assert.equal(followUp.booking_page, "/connexion");
    const clientRequest = requests.at(-2);
    assert.match(clientRequest.input.at(-1).content, /un client connecté/);
    // Ni le nom, ni l'e-mail, ni le téléphone du compte ne partent chez OpenAI.
    const sent = JSON.stringify(requests);
    for (const personal of ["camille@example.test", "Camille Test", "06 11 22 33 44", "gerant@example.test"])
      assert.ok(!sent.includes(personal), personal);

    // Gérant : reconnu comme tel dans le contexte.
    slotArguments = null;
    await ask("Comment ajouter des disponibilités ?", { cookie: admin });
    assert.match(requests.at(-1).input.at(-1).content, /le gérant du site/);

    // Débit : 20 messages par quart d'heure et par adresse, compteur en base sous forme d'empreinte.
    const statuses = [];
    for (let index = 0; index < 21; index++) statuses.push((await ask(`Question ${index}`, { ip: "192.0.2.99" })).response.status);
    assert.deepEqual(statuses, [...Array(20).fill(200), 429]);
    const check = new pg.Client({ connectionString: databaseUrl.toString() });
    await check.connect();
    try {
      const { rows } = await check.query("SELECT email, count FROM login_attempts WHERE email LIKE 'assistant:%'");
      const counters = rows.filter((row) => row.email.startsWith("assistant:ip:"));
      assert.ok(counters.length >= 2);
      for (const row of counters) assert.match(row.email, /^assistant:ip:[0-9a-f]{32}$/);
      assert.ok(!rows.some((row) => row.email.includes("192.0.2.")), "aucune adresse IP en clair");
      assert.ok(counters.some((row) => row.count === 21));
      assert.ok(rows.some((row) => /^assistant:day:\d{4}-\d{2}-\d{2}$/.test(row.email)));
    } finally {
      await check.end();
    }
  } catch (error) {
    error.message += "\n" + logs;
    throw error;
  } finally {
    server.kill();
    if (server.exitCode === null) await new Promise((resolve) => server.once("exit", resolve));
    openai.close();
    await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await maintenance.end();
  }
});
