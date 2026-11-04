import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

// Rappel e-mail la veille du rendez-vous (GET /api/cron/rappels), contre un faux Resend.
// Même mise en place que portal.test.mjs : base Postgres temporaire et serveur de production.
const adminUrl =
  process.env.TEST_DATABASE_URL ||
  "postgres://synego:synego@localhost:5432/synego";

test("rappels de la veille : jeton, lendemain seulement, idempotence, déplacement, langue", { timeout: 60000 }, async () => {
  const database = "synego_test_" + randomBytes(6).toString("hex");
  const maintenance = new pg.Client({ connectionString: adminUrl });
  await maintenance.connect();
  await maintenance.query(`CREATE DATABASE ${database}`);
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = "/" + database;
  const password = randomBytes(20).toString("hex");
  const cronSecret = randomBytes(24).toString("hex");
  const port = Number(process.env.TEST_PORT) || 43127,
    origin = `http://127.0.0.1:${port}`;

  // Faux Resend : garde les e-mails reçus ; refuse (500) les adresses de `failing`.
  const sendKey = "re_test_" + randomBytes(16).toString("hex");
  const mails = [];
  const failing = new Set();
  const send = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.method !== "POST" || req.url !== "/emails" || req.headers.authorization !== `Bearer ${sendKey}`) {
      res.writeHead(401);
      return res.end();
    }
    const mail = JSON.parse(body);
    if (mail.to.some((to) => failing.has(to))) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ name: "internal_server_error" }));
    }
    mails.push(mail);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: `resend-${mails.length}` }));
  });
  await new Promise((resolve) => send.listen(0, "127.0.0.1", resolve));

  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        DATABASE_URL: databaseUrl.toString(),
        DATABASE_URL_UNPOOLED: databaseUrl.toString(),
        ADMIN_EMAIL: "gerant@example.test",
        ADMIN_PASSWORD: password,
        CRON_SECRET: cronSecret,
        RESEND_API_KEY: sendKey,
        RESEND_API_URL: `http://127.0.0.1:${send.address().port}/emails`,
        MAIL_ADMIN_TO: "gerant@example.test",
        SITE_URL: "https://synego.example.test",
        // Pas de synchronisation Google ni de flux d'abonnement dans ce test.
        CALENDAR_FEED_TOKEN: "",
        GOOGLE_CALENDAR_ID: "",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
        GOOGLE_PRIVATE_KEY: "",
      },
      stdio: "pipe",
    },
  );
  let logs = "";
  server.stdout.on("data", (data) => (logs += data));
  server.stderr.on("data", (data) => (logs += data));

  const sql = new pg.Client({ connectionString: databaseUrl.toString() });
  async function portal(data, { cookie = "", language = "fr" } = {}) {
    const response = await fetch(origin + "/api/portal", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "Accept-Language": language,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(data),
    });
    return { response, data: await response.json() };
  }
  const cron = (authorization) =>
    fetch(origin + "/api/cron/rappels", authorization ? { headers: { Authorization: authorization } } : {});
  async function runCron() {
    const response = await cron(`Bearer ${cronSecret}`);
    assert.equal(response.status, 200, logs);
    return response.json();
  }
  const reminders = () => mails.filter((mail) => /^(Rappel|Reminder)/.test(mail.subject));
  const remindersTo = (address) => reminders().filter((mail) => mail.to.includes(address));

  // Heure de Paris calculée par Postgres : `day` jours après aujourd'hui (date de Paris), à `time`.
  const paris = (day, time) =>
    `(((now() AT TIME ZONE 'Europe/Paris')::date + ${Number(day)} + time '${time}') AT TIME ZONE 'Europe/Paris')`;
  async function insertSlot(day, time, minutes) {
    const { rows } = await sql.query(
      `INSERT INTO slots (starts, ends) VALUES (${paris(day, time)}, ${paris(day, time)} + make_interval(mins => $1)) RETURNING id`,
      [minutes],
    );
    return rows[0].id;
  }
  // Rendez-vous inséré directement (sans `locale` : valeur par défaut des rendez-vous existants).
  async function insertAppointment({ day, time, email, userId = null, status = "confirmed", reminded = false }) {
    const { rows } = await sql.query(
      `INSERT INTO appointments (user_id, type, format, first_name, last_name, email, phone, intention, starts, ends, status, reminder_sent_at)
       VALUES ($1, 'vente', 'visio', 'Camille', 'Test', $2, '06 00 00 00 00', 'Intention confidentielle', ${paris(day, time)},
               ${paris(day, time)} + interval '45 minutes', $3, ${reminded ? "now()" : "NULL"})
       RETURNING id`,
      [userId, email, status],
    );
    return rows[0].id;
  }
  const appointment = async (id) =>
    (await sql.query("SELECT locale, reminder_sent_at FROM appointments WHERE id = $1", [id])).rows[0];

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      try {
        // Premier accès à la base : applique les migrations.
        ready = (await fetch(origin + "/api/portal?action=slots&type=vente")).ok;
      } catch {}
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, logs);
    await sql.connect();

    // Jeton exigé (Vercel envoie « Authorization: Bearer <CRON_SECRET> »).
    for (const authorization of [undefined, `Bearer ${cronSecret}x`, cronSecret, "Bearer "])
      assert.equal((await cron(authorization)).status, 401, String(authorization));
    assert.equal(reminders().length, 0);

    // Un client avec compte, et des rendez-vous autour du lendemain.
    const registered = await portal({
      action: "register",
      name: "Client Compte",
      email: "client@example.test",
      phone: "06 11 22 33 44",
      password,
      consent: true,
    });
    assert.equal(registered.response.status, 200);
    const clientCookie = registered.response.headers.get("set-cookie").split(";")[0];
    const clientId = (await sql.query("SELECT id FROM users WHERE email = 'client@example.test'")).rows[0].id;

    const prospect = await insertAppointment({ day: 1, time: "10:00", email: "prospect@example.test" });
    const client = await insertAppointment({ day: 1, time: "16:00", email: "client@example.test", userId: clientId });
    await insertAppointment({ day: 1, time: "11:00", email: "annule@example.test", status: "cancelled" });
    await insertAppointment({ day: 2, time: "10:00", email: "apres-demain@example.test" });
    // Rendez-vous d'hier jamais rappelé (appel manqué) : pas de rappel après coup.
    await insertAppointment({ day: -1, time: "10:00", email: "hier@example.test" });
    await insertAppointment({ day: 0, time: "00:00", email: "aujourdhui@example.test" });

    // Réservation en anglais depuis le site : la langue est enregistrée avec le rendez-vous.
    const englishSlot = await insertSlot(1, "14:00", 45);
    const booked = await portal(
      {
        action: "reserve",
        consent: true,
        type: "vente",
        slot: englishSlot,
        format: "visio",
        firstName: "Alex",
        lastName: "English",
        email: "english@example.test",
        phone: "+44 20 7946 0000",
        intention: "Intention confidentielle",
      },
      { language: "en-GB,en;q=0.9" },
    );
    assert.equal(booked.response.status, 200, JSON.stringify(booked.data));
    assert.equal((await appointment(booked.data.reference)).locale, "en");
    assert.equal((await appointment(prospect)).locale, "fr");

    // Deux appels simultanés : un seul rappel par rendez-vous.
    const [first, second] = await Promise.all([runCron(), runCron()]);
    assert.equal(first.sent + second.sent, 3, JSON.stringify([first, second]));
    assert.equal(first.failed + second.failed, 0);
    // Synthèse sans donnée personnelle.
    assert.deepEqual(Object.keys(first).sort(), ["failed", "sent", "skipped"]);
    assert.deepEqual(
      reminders().map((mail) => mail.to[0]).sort(),
      ["client@example.test", "english@example.test", "prospect@example.test"],
    );

    // Contenu : français par défaut, anglais pour la réservation faite en anglais.
    const [french] = remindersTo("prospect@example.test");
    assert.match(french.subject, /^Rappel : votre rendez-vous demain, .+ 10:00$/);
    assert.ok(french.text.includes("Bonjour Camille Test,"));
    assert.ok(french.text.includes("Durée : 45 minutes"));
    assert.ok(french.text.includes("Ajouter à Google Agenda : https://calendar.google.com/"));
    assert.ok(french.text.includes("Youcef vous communiquera le lien de visioconférence"));
    assert.ok(french.text.includes("Prévenez Youcef au plus vite"));
    assert.ok(!french.text.includes("/connexion"), "pas d'espace client pour un prospect");
    assert.ok(french.html.startsWith("<!doctype html>") && french.html.includes('lang="fr"'));
    const [english] = remindersTo("english@example.test");
    assert.match(english.subject, /^Reminder: your appointment tomorrow, .+ 14:00$/);
    assert.ok(english.text.includes("Hello Alex English,"), english.text);
    assert.ok(english.text.includes("Duration: 45 minutes"), english.text);
    assert.ok(english.html.includes('lang="en"'));
    const [account] = remindersTo("client@example.test");
    assert.ok(account.text.includes("depuis votre espace client"));
    assert.ok(account.text.includes("https://synego.example.test/connexion"));
    // « Ce qui vous amène » n'apparaît jamais.
    assert.ok(reminders().every((mail) => !JSON.stringify(mail).includes("Intention confidentielle")));

    // Nouvel appel le même jour : rien de plus.
    assert.deepEqual(await runCron(), { sent: 0, skipped: 3, failed: 0 });
    assert.equal(reminders().length, 3);

    // Déplacement par le gérant (sans délai de 24 h) : un nouveau rappel part.
    const admin = await portal({ action: "login", email: "gerant@example.test", password });
    const adminCookie = admin.response.headers.get("set-cookie").split(";")[0];
    const noon = await insertSlot(1, "12:00", 60);
    const moved = await portal({ action: "owner-reschedule", id: prospect, slot: noon, notify: false }, { cookie: adminCookie });
    assert.equal(moved.response.status, 200, JSON.stringify(moved.data));
    assert.equal((await appointment(prospect)).reminder_sent_at, null);
    assert.deepEqual(await runCron(), { sent: 1, skipped: 2, failed: 0 });
    assert.equal(remindersTo("prospect@example.test").length, 2);
    assert.match(remindersTo("prospect@example.test")[1].subject, / 12:00$/);

    // Déplacement par le client : rappel réinitialisé et langue de la requête enregistrée.
    const later = await insertAppointment({ day: 2, time: "15:00", email: "client@example.test", userId: clientId, reminded: true });
    const laterSlot = await insertSlot(3, "15:00", 60);
    const clientMove = await portal({ action: "reschedule", id: later, slot: laterSlot }, { cookie: clientCookie, language: "en" });
    assert.equal(clientMove.response.status, 200, JSON.stringify(clientMove.data));
    assert.deepEqual(await appointment(later), { locale: "en", reminder_sent_at: null });
    assert.equal((await appointment(client)).locale, "fr");

    // Échec Resend : compté, journalisé avec l'adresse masquée, puis réessayé à l'appel suivant.
    failing.add("echec@example.test");
    const failed = await insertAppointment({ day: 1, time: "18:00", email: "echec@example.test" });
    assert.deepEqual(await runCron(), { sent: 0, skipped: 3, failed: 1 });
    assert.equal((await appointment(failed)).reminder_sent_at, null);
    assert.ok(logs.includes("e***@example.test") && !logs.includes("echec@example.test"), logs);
    failing.delete("echec@example.test");
    assert.deepEqual(await runCron(), { sent: 1, skipped: 3, failed: 0 });
    assert.equal(remindersTo("echec@example.test").length, 1);
  } finally {
    send.close();
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    await sql.end().catch(() => {});
    await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await maintenance.end();
  }
});
