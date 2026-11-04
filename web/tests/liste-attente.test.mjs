import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

// Liste d'attente « Prévenez-moi si un créneau se libère » : inscription, alerte à l'ajout de
// disponibilités et à l'annulation, une seule alerte par inscription, désinscription.
// Même mise en place que tests/portal.test.mjs : base temporaire et faux serveur Resend.
const adminUrl = process.env.TEST_DATABASE_URL || "postgres://synego:synego@localhost:5432/synego";

test("liste d'attente : inscription, alertes et désinscription", { timeout: 90000 }, async () => {
  const database = "synego_test_" + randomBytes(6).toString("hex");
  const maintenance = new pg.Client({ connectionString: adminUrl });
  await maintenance.connect();
  await maintenance.query(`CREATE DATABASE ${database}`);
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = "/" + database;
  const password = randomBytes(20).toString("hex");
  const port = Number(process.env.TEST_PORT) || 43214;
  const origin = `http://127.0.0.1:${port}`;

  // Faux Resend : vérifie la clé et garde les e-mails reçus.
  const sendKey = "re_test_" + randomBytes(16).toString("hex");
  const mails = [];
  const send = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    if (req.method !== "POST" || req.url !== "/emails" || req.headers.authorization !== `Bearer ${sendKey}`) {
      res.writeHead(401);
      return res.end();
    }
    mails.push(JSON.parse(body));
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
        // Pas de synchronisation Google ni de lien d'abonnement pour ce test.
        CALENDAR_FEED_TOKEN: "",
        GOOGLE_CALENDAR_ID: "",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
        GOOGLE_PRIVATE_KEY: "",
        RESEND_API_KEY: sendKey,
        RESEND_API_URL: `http://127.0.0.1:${send.address().port}/emails`,
        MAIL_FROM: "noreply@abdu.fr",
        MAIL_ADMIN_TO: "",
        SITE_URL: "https://synego.example.test",
      },
      stdio: "pipe",
    },
  );
  let logs = "";
  server.stdout.on("data", (data) => (logs += data));
  server.stderr.on("data", (data) => (logs += data));

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function eventually(check, label) {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (check()) return;
      await pause(100);
    }
    assert.fail(label + "\n" + logs);
  }
  const mailsTo = (address, subjectPart = "") =>
    mails.filter((mail) => mail.to.includes(address) && mail.subject.includes(subjectPart));
  async function mailTo(address, subjectPart, count = 1) {
    await eventually(() => mailsTo(address, subjectPart).length >= count, `e-mail « ${subjectPart} » non reçu par ${address}`);
    return mailsTo(address, subjectPart).at(-1);
  }
  async function request(data, { cookie = "", method = "POST", language } = {}) {
    const response = await fetch(origin + "/api/portal" + (method === "GET" ? data : ""), {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(language ? { "Accept-Language": language } : {}),
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(data) }),
    });
    return { response, data: await response.json() };
  }
  const cookieOf = (result) => result.response.headers.get("set-cookie").split(";")[0];
  const subscribe = (email, type, options = {}) =>
    request({ action: "waitlist-subscribe", email, type, consent: true }, options);
  const unsubscribe = (token) => request({ action: "waitlist-unsubscribe", token });
  const tokenOf = (mail) => decodeURIComponent(mail.text.match(/desinscription\?token=(\S+)/)[1]);
  const parisDate = (time, locale) =>
    new Date(time).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", {
      timeZone: "Europe/Paris",
      dateStyle: "full",
      timeStyle: "short",
    });

  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      await pause(100);
    }
    // Pages : formulaire sous le choix du créneau, page de désinscription bilingue.
    const booking = await (await fetch(origin + "/rendez-vous", { headers: { Cookie: "synego-locale=fr" } })).text();
    assert.ok(booking.includes("Prévenez-moi si un créneau se libère"), logs);
    for (const [locale, title] of [["fr", "Se désinscrire de la liste d’attente"], ["en", "Leave the waiting list"]]) {
      const page = await fetch(origin + "/liste-attente/desinscription?token=abc", {
        headers: { Cookie: `synego-locale=${locale}` },
      });
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes(title), `${locale} : page de désinscription`);
      assert.ok(html.includes('content="noindex'), "page non indexée");
    }

    const admin = cookieOf(await request({ action: "login", email: "gerant@example.test", password }));
    const counts = async () => (await request("", { cookie: admin, method: "GET" })).data.waitlist;
    assert.deepEqual(await counts(), { vente: 0, audit: 0, suivi: 0 });

    // Validation : accord obligatoire, adresse valide, type connu, suivi réservé aux clients.
    const refused = await request({ action: "waitlist-subscribe", email: "alice@example.test", type: "vente" });
    assert.equal(refused.response.status, 400);
    assert.deepEqual([refused.data.code, refused.data.field], ["waitlistConsent", "consent"]);
    assert.equal((await subscribe("pas-une-adresse", "vente")).data.code, "invalidEmail");
    assert.equal((await subscribe("alice@example.test", "inconnu")).response.status, 400);
    assert.equal((await subscribe("alice@example.test", "suivi")).response.status, 401);

    // Un créneau d'une heure, réservé par un prospect.
    const hour = 3600_000;
    const day = 24 * hour;
    const base = Math.ceil(Date.now() / hour) * hour + 3 * day;
    assert.equal((await request({ action: "add-slot", starts: base, ends: base + hour, minutes: 60 }, { cookie: admin })).response.status, 200);
    const [slot] = (await request("?action=slots&type=vente", { method: "GET" })).data.slots;
    const reserved = await request({
      action: "reserve", type: "vente", slot: slot.id, format: "visio", firstName: "Paul", lastName: "Prospect",
      email: "paul@example.test", phone: "06 11 22 33 44", intention: "Découvrir", consent: true,
    });
    assert.equal(reserved.response.status, 200, JSON.stringify(reserved.data));

    // Inscriptions : sans compte (français et anglais) et client connecté (suivi).
    for (const [email, type, language] of [
      ["alice@example.test", "vente", "fr"],
      ["bob@example.test", "vente", "en"],
      ["carol@example.test", "audit", "fr"],
    ]) {
      const result = await subscribe(email, type, { language });
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.data, { ok: true });
    }
    const dave = cookieOf(
      await request({ action: "register", name: "Dave", email: "dave@example.test", phone: "06 11 22 33 44", password, consent: true }),
    );
    assert.equal((await subscribe("dave@example.test", "suivi", { cookie: dave })).response.status, 200);
    const aliceJoined = await mailTo("alice@example.test", "Liste d’attente");
    assert.ok(aliceJoined.subject.includes("Appel découverte"));
    assert.ok(aliceJoined.text.includes("pour votre appel découverte") && aliceJoined.text.includes("30 jours"), aliceJoined.text);
    assert.match(aliceJoined.text, /https:\/\/synego\.example\.test\/liste-attente\/desinscription\?token=\S+/);
    assert.ok(aliceJoined.html.includes("/liste-attente/desinscription?token="));
    const bobJoined = await mailTo("bob@example.test", "Waiting list");
    assert.ok(bobJoined.subject.includes("Discovery call") && bobJoined.text.includes("for your discovery call"));
    await mailTo("dave@example.test", "Liste d’attente");
    // Réinscription : même réponse, l'inscription est mise à jour (pas de doublon).
    assert.deepEqual((await subscribe("alice@example.test", "vente")).data, { ok: true });
    assert.deepEqual(await counts(), { vente: 2, audit: 1, suivi: 1 });

    // Nouvelles disponibilités de 45 min : découverte et audit prévenus, pas le suivi (1 h).
    const range = base + day;
    assert.equal(
      (await request({ action: "add-slot", starts: range, ends: range + 1.5 * hour, minutes: 45 }, { cookie: admin })).response.status,
      200,
    );
    const aliceFreed = await mailTo("alice@example.test", "Un créneau vient de se libérer");
    assert.ok(aliceFreed.subject.includes("Appel découverte"));
    for (const time of [range, range + 0.75 * hour]) assert.ok(aliceFreed.text.includes(parisDate(time, "fr")), aliceFreed.text);
    assert.ok(aliceFreed.text.includes("Premier arrivé, premier servi"));
    assert.ok(aliceFreed.text.includes("https://synego.example.test/rendez-vous"));
    assert.ok(aliceFreed.html.includes("Un créneau vient de se libérer"));
    const bobFreed = await mailTo("bob@example.test", "A slot has just opened up");
    assert.ok(bobFreed.text.includes(parisDate(range, "en")) && bobFreed.text.includes("First come, first served"));
    await mailTo("carol@example.test", "Un créneau vient de se libérer");
    await pause(800);
    assert.equal(mailsTo("dave@example.test", "Un créneau").length, 0);
    assert.deepEqual(await counts(), { vente: 0, audit: 0, suivi: 1 });

    // Annulation par le gérant : le créneau d'une heure se libère. Dave (suivi) et Alice, réinscrite,
    // sont prévenus ; Bob et Carol ont déjà reçu leur alerte et ne le sont pas une deuxième fois.
    assert.equal((await subscribe("alice@example.test", "vente")).response.status, 200);
    assert.equal(
      (await request({ action: "owner-cancel", id: reserved.data.reference, notify: false }, { cookie: admin })).response.status,
      200,
    );
    const aliceAgain = await mailTo("alice@example.test", "Un créneau vient de se libérer", 2);
    assert.ok(aliceAgain.text.includes(parisDate(base, "fr")));
    const daveFreed = await mailTo("dave@example.test", "Un créneau vient de se libérer");
    assert.ok(daveFreed.subject.includes("Séance de suivi"));
    assert.ok(daveFreed.text.includes("https://synego.example.test/connexion"));
    // Nouvelle plage : plus personne n'est en attente, aucun nouvel e-mail.
    await request({ action: "add-slot", starts: base + 2 * day, ends: base + 2 * day + hour, minutes: 60 }, { cookie: admin });
    await pause(1000);
    assert.deepEqual(
      ["alice", "bob", "carol", "dave"].map((name) => mailsTo(`${name}@example.test`, "vient de se libérer").length + mailsTo(`${name}@example.test`, "opened up").length),
      [2, 1, 1, 1],
    );
    assert.deepEqual(await counts(), { vente: 0, audit: 0, suivi: 0 });

    // Créneau libéré à moins de 2 heures : pas d'alerte.
    assert.equal((await subscribe("erin@example.test", "vente")).response.status, 200);
    const erinJoined = await mailTo("erin@example.test", "Liste d’attente");
    const soon = Math.ceil((Date.now() + 10 * 60_000) / 60_000) * 60_000;
    assert.equal((await request({ action: "add-slot", starts: soon, ends: soon + hour, minutes: 60 }, { cookie: admin })).response.status, 200);
    await pause(1000);
    assert.equal(mailsTo("erin@example.test", "Un créneau").length, 0);
    assert.equal((await counts()).vente, 1);

    // Désinscription : lien à usage unique ; le lien de l'e-mail le plus récent fait foi.
    assert.equal((await unsubscribe(tokenOf(erinJoined))).response.status, 200);
    const reused = await unsubscribe(tokenOf(erinJoined));
    assert.equal(reused.response.status, 400);
    assert.equal(reused.data.code, "waitlistLinkInvalid");
    assert.equal((await unsubscribe("jeton-inconnu")).data.code, "waitlistLinkInvalid");
    assert.equal((await counts()).vente, 0);
    assert.equal((await unsubscribe(tokenOf(bobJoined))).data.code, "waitlistLinkInvalid");
    assert.equal((await unsubscribe(tokenOf(bobFreed))).response.status, 200);
    const english = await fetch(origin + "/api/portal", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "Accept-Language": "en" },
      body: JSON.stringify({ action: "waitlist-unsubscribe", token: tokenOf(bobFreed) }),
    });
    assert.match((await english.json()).error, /no longer valid/);

    // Limitation : 5 inscriptions au plus par adresse et par quart d'heure, réponse identique.
    for (let attempt = 0; attempt < 7; attempt++)
      assert.deepEqual((await subscribe("frank@example.test", attempt % 2 ? "audit" : "vente")).data, { ok: true });
    await pause(800);
    assert.equal(mailsTo("frank@example.test", "Liste d’attente").length, 5);

    // Tous les e-mails ont une version texte et HTML, sans la clé d'API.
    assert.ok(mails.every((mail) => mail.text && mail.html && !JSON.stringify(mail).includes(sendKey)));
  } finally {
    send.close();
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await maintenance.end();
  }
});
