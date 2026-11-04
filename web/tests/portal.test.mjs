import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createVerify, generateKeyPairSync, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

// Base Postgres d'administration : celle de docker-compose.yml par défaut.
const adminUrl =
  process.env.TEST_DATABASE_URL ||
  "postgres://synego:synego@localhost:5432/synego";

test(
  "réservation, comptes, isolation des documents et demandes de support",
  { timeout: 60000 },
  async () => {
    // Base temporaire indépendante, supprimée à la fin du test.
    const database = "synego_test_" + randomBytes(6).toString("hex");
    const maintenance = new pg.Client({ connectionString: adminUrl });
    await maintenance.connect();
    await maintenance.query(`CREATE DATABASE ${database}`);
    const databaseUrl = new URL(adminUrl);
    databaseUrl.pathname = "/" + database;
    const password = randomBytes(20).toString("hex");
    const port = Number(process.env.TEST_PORT) || 43127,
      origin = `http://127.0.0.1:${port}`;

    // Faux Google (jeton OAuth et API Agenda) : vérifie la signature du compte de service
    // et garde les événements en mémoire, pour tester la synchronisation sans vraies clés.
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const calendarId = "agenda-test@group.calendar.google.com";
    const googleEvents = new Map();
    const googleCalls = [];
    const google = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const url = new URL(req.url, "http://127.0.0.1");
      googleCalls.push({ method: req.method, path: decodeURIComponent(url.pathname) });
      const reply = (status, data) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(data === undefined ? "" : JSON.stringify(data));
      };
      if (url.pathname === "/token") {
        const [header, claims, signature] = new URLSearchParams(body).get("assertion").split(".");
        const valid = createVerify("RSA-SHA256")
          .update(`${header}.${claims}`)
          .verify(publicKey, Buffer.from(signature, "base64url"));
        return valid
          ? reply(200, { access_token: "jeton-test", expires_in: 3600 })
          : reply(401, { error: "invalid_grant" });
      }
      if (req.headers.authorization !== "Bearer jeton-test") return reply(401);
      const match = decodeURIComponent(url.pathname).match(
        /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/,
      );
      if (!match || match[1] !== calendarId) return reply(404);
      const eventId = match[2];
      if (req.method === "POST") {
        const event = JSON.parse(body);
        googleEvents.set(event.id, event);
        return reply(200, event);
      }
      if (req.method === "PUT") {
        if (!googleEvents.has(eventId)) return reply(404);
        googleEvents.set(eventId, JSON.parse(body));
        return reply(200, JSON.parse(body));
      }
      if (req.method === "DELETE") return reply(googleEvents.delete(eventId) ? 204 : 410);
      return reply(405);
    });
    await new Promise((resolve) => google.listen(0, "127.0.0.1", resolve));
    const googleUrl = `http://127.0.0.1:${google.address().port}`;
    const googleEventId = (id) => `rdv${String(id).padStart(6, "0")}`;
    // La synchronisation a lieu après la réponse : on attend qu'elle arrive.
    async function eventually(check, label) {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.fail(label + "\n" + logs);
    }
    const feedToken = randomBytes(24).toString("hex");

    // Faux Resend : vérifie la clé (Bearer) et garde les e-mails reçus, sans rien envoyer.
    // Chaque e-mail est gardé tel que reçu (`raw`) et décomposé pour les vérifications :
    // `from` (adresse), `fromName` (nom affiché) et `replyTo`.
    const sendKey = "re_test_" + randomBytes(16).toString("hex");
    const mails = [];
    const send = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      if (req.method !== "POST" || req.url !== "/emails") {
        res.writeHead(404);
        return res.end();
      }
      if (req.headers.authorization !== `Bearer ${sendKey}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ name: "validation_error", message: "API key is invalid" }));
      }
      const raw = JSON.parse(body);
      const [, fromName, from] = raw.from.match(/^"(.*)" <(.+)>$/) ?? [];
      mails.push({ ...raw, raw, from, fromName, replyTo: raw.reply_to });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: `resend-${mails.length}` }));
    });
    await new Promise((resolve) => send.listen(0, "127.0.0.1", resolve));
    const sendUrl = `http://127.0.0.1:${send.address().port}/emails`;
    const mailsTo = (address, subjectPart = "") =>
      mails.filter((mail) => mail.to.includes(address) && mail.subject.includes(subjectPart));
    // Attend un e-mail précis (envoyé après la réponse) et le renvoie.
    async function mailTo(address, subjectPart) {
      await eventually(() => mailsTo(address, subjectPart).length, `e-mail « ${subjectPart} » non reçu par ${address}`);
      return mailsTo(address, subjectPart).at(-1);
    }
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      {
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
          DATABASE_URL: databaseUrl.toString(),
          // Écrase la connexion directe Neon éventuellement présente dans .env.local.
          DATABASE_URL_UNPOOLED: databaseUrl.toString(),
          ADMIN_EMAIL: "gerant@example.test",
          ADMIN_PASSWORD: password,
          // Agenda : lien d'abonnement et synchronisation vers le faux Google.
          CALENDAR_FEED_TOKEN: feedToken,
          GOOGLE_CALENDAR_ID: calendarId,
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "synego@projet-test.iam.gserviceaccount.com",
          GOOGLE_PRIVATE_KEY: privateKey,
          GOOGLE_CALENDAR_API_URL: googleUrl + "/calendar/v3",
          GOOGLE_TOKEN_URL: googleUrl + "/token",
          // E-mails : vers le faux Resend.
          RESEND_API_KEY: sendKey,
          RESEND_API_URL: sendUrl,
          MAIL_FROM: "noreply@abdu.fr",
          MAIL_FROM_NAME: "Youcef · Synégo",
          // Même domaine que MAIL_FROM : accepté comme Reply-To (un autre domaine serait ignoré).
          MAIL_REPLY_TO: "contact@abdu.fr",
          SITE_URL: "https://synego.example.test",
        },
        stdio: "pipe",
      },
    );
    let logs = "";
    server.stdout.on("data", (data) => (logs += data));
    server.stderr.on("data", (data) => (logs += data));
    async function request(data, cookie = "", method = "POST") {
      const response = await fetch(
        origin + "/api/portal" + (method === "GET" ? data : ""),
        {
          method,
          headers: {
            Origin: origin,
            ...(cookie ? { Cookie: cookie } : {}),
            ...(data instanceof FormData || method === "GET"
              ? {}
              : { "Content-Type": "application/json" }),
          },
          ...(method === "GET"
            ? {}
            : { body: data instanceof FormData ? data : JSON.stringify(data) }),
        },
      );
      return {
        response,
        data: response.headers.get("content-type")?.includes("json")
          ? await response.json()
          : await response.arrayBuffer(),
      };
    }
    async function login(email) {
      const result = await request({ action: "login", email, password });
      assert.equal(result.response.status, 200);
      return result.response.headers.get("set-cookie").split(";")[0];
    }
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          if ((await fetch(origin)).ok) break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      for (const page of [
        "/",
        "/seminaires",
        "/rendez-vous",
        "/connexion",
        "/mentions-legales",
        "/confidentialite",
      ])
        assert.equal((await fetch(origin + page)).status, 200, page + logs);
      assert.equal(
        (await request({ action: "add-slot", starts: 1, ends: 2 })).response
          .status,
        403,
      );
      assert.equal(
        (await request("?action=slots&type=suivi", "", "GET")).response.status,
        401,
      );
      assert.equal(
        (
          await request({
            action: "login",
            email: "gerant@example.test",
            password: "incorrect",
          })
        ).response.status,
        401,
      );
      const admin = await login("gerant@example.test");
      const crossOrigin = await fetch(origin + "/api/portal", {
        method: "POST",
        headers: {
          Origin: "https://example.test",
          Cookie: admin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "logout" }),
      });
      assert.equal(crossOrigin.status, 403);
      // Deux façons d'obtenir un compte client : création par le gérant ou inscription libre.
      const newClient = (name, extra = {}) => ({
        action: "create-client",
        name,
        email: name.toLowerCase() + "@example.test",
        phone: "06 11 22 33 44",
        ...extra,
      });
      assert.equal((await request(newClient("Visiteur"))).response.status, 403);
      const signUp = (extra = {}) =>
        request({ ...newClient("Inscrit"), action: "register", password, consent: true, ...extra });
      assert.equal((await signUp({ consent: false })).response.status, 400);
      const shortPassword = await signUp({ password: "trop-court" });
      assert.equal(shortPassword.response.status, 400);
      assert.equal(shortPassword.data.field, "password");
      const registered = await signUp();
      assert.equal(registered.response.status, 200);
      const welcome = await mailTo("inscrit@example.test", "Bienvenue");
      assert.equal(welcome.from, "noreply@abdu.fr");
      assert.equal(welcome.fromName, "Youcef · Synégo");
      assert.equal(welcome.replyTo, "contact@abdu.fr");
      // Format exact attendu par Resend.
      assert.equal(welcome.raw.from, '"Youcef · Synégo" <noreply@abdu.fr>');
      assert.deepEqual(welcome.raw.to, ["inscrit@example.test"]);
      assert.equal(welcome.raw.reply_to, "contact@abdu.fr");
      assert.ok(welcome.text.includes("merci de ne pas y répondre"));
      assert.ok(welcome.html.startsWith("<!doctype html>") && welcome.text.includes("Bonjour Inscrit,"));
      // L'inscription ouvre directement une session client, avec un mot de passe définitif.
      const registeredSession = registered.response.headers.get("set-cookie").split(";")[0];
      const registeredView = (await request("", registeredSession, "GET")).data.user;
      assert.deepEqual(
        [registeredView.role, registeredView.phone, registeredView.passwordTemporary],
        ["client", "06 11 22 33 44", false],
      );
      // Bouton d'accès de l'en-tête : « Se connecter » pour un visiteur, sinon l'espace du compte.
      const headerLabel = async (cookie = "") => {
        const html = await (
          await fetch(origin + "/", {
            headers: { "Accept-Language": "fr", ...(cookie ? { Cookie: cookie } : {}) },
          })
        ).text();
        return html.match(/data-slot="button"[^>]*href="\/connexion">([^<]+)</)?.[1];
      };
      assert.equal(await headerLabel(), "Se connecter");
      assert.equal(await headerLabel("session=jeton-inconnu"), "Se connecter");
      assert.equal(await headerLabel(registeredSession), "Espace client");
      assert.equal(await headerLabel(admin), "Espace gérant");
      const duplicate = await signUp();
      assert.equal(duplicate.response.status, 409);
      assert.equal(duplicate.data.field, "email");
      assert.equal(
        (await request({ action: "login", email: "inscrit@example.test", password }))
          .response.status,
        200,
      );
      assert.equal(
        (await request(newClient("Alice", { phone: "abc" }), admin)).response.status,
        400,
      );
      const created = await request(newClient("Alice"), admin);
      assert.equal(created.response.status, 200);
      // Mot de passe provisoire renvoyé une seule fois ; aucune session n'est ouverte pour le gérant.
      assert.match(created.data.password, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      assert.equal(created.response.headers.get("set-cookie"), null);
      assert.equal((await request(newClient("Alice"), admin)).response.status, 409);
      const createdBob = await request(newClient("Bob"), admin);
      const aliceInvite = await mailTo("alice@example.test", "vous a ouvert un espace client");
      assert.match(aliceInvite.text, /https:\/\/synego\.example\.test\/reinitialiser-mot-de-passe\?token=\S+/);
      // Le mot de passe provisoire n'est jamais envoyé par e-mail.
      assert.ok(!aliceInvite.text.includes(created.data.password));
      const bobInvite = await mailTo("bob@example.test", "vous a ouvert un espace client");
      assert.notEqual(createdBob.data.password, created.data.password);
      const listed = (await request("", admin, "GET")).data.clients;
      assert.deepEqual(
        listed.map((client) => [client.email, client.passwordTemporary, "password" in client]),
        [
          ["alice@example.test", true, false],
          ["bob@example.test", true, false],
          // Compte créé par inscription libre : pas de mot de passe provisoire.
          ["inscrit@example.test", false, false],
        ],
      );
      // Le client se connecte avec le mot de passe provisoire, puis le remplace.
      for (const [email, temporary] of [
        ["alice@example.test", created.data.password],
        ["bob@example.test", createdBob.data.password],
      ]) {
        const first = await request({ action: "login", email, password: temporary });
        assert.equal(first.response.status, 200);
        const cookie = first.response.headers.get("set-cookie").split(";")[0];
        const view = (await request("", cookie, "GET")).data;
        assert.deepEqual(
          [view.user.role, view.user.phone, view.user.passwordTemporary],
          ["client", "06 11 22 33 44", true],
        );
        assert.equal(
          (
            await request(
              { action: "change-password", currentPassword: temporary, password },
              cookie,
            )
          ).response.status,
          200,
        );
        assert.equal((await request("", cookie, "GET")).data.user.passwordTemporary, false);
      }
      assert.ok(
        !(await request("", admin, "GET")).data.clients.some(
          (client) => client.passwordTemporary,
        ),
      );
      const alice = await login("alice@example.test"),
        bob = await login("bob@example.test");
      const starts = Date.now() + 86400000,
        ends = starts + 3600000;
      assert.equal(
        (await request({ action: "add-slot", starts, ends, minutes: 60 }, admin)).response
          .status,
        200,
      );
      // Prospect : tous les champs du compte rendu sont obligatoires.
      const prospect = {
        action: "reserve",
        type: "vente",
        format: "visio",
        firstName: "Camille",
        lastName: "Martin",
        email: "camille@example.test",
        phone: "+33 6 12 34 56 78",
        intention: "Je me sens vide depuis quelques mois.",
        consent: true,
      };
      const prospectSlot = (
        await request("?action=slots&type=vente", "", "GET")
      ).data.slots[0].id;
      const invalidPhone = await request(
        { ...prospect, slot: prospectSlot, phone: "abc" },
        "",
      );
      assert.equal(invalidPhone.response.status, 400);
      assert.equal(invalidPhone.data.error, "Numéro de téléphone invalide.");
      assert.equal(invalidPhone.data.field, "phone");
      assert.equal(
        (
          await request({ ...prospect, slot: prospectSlot, format: "presentiel" })
        ).response.status,
        400,
      );
      assert.equal(
        (await request({ ...prospect, slot: prospectSlot, consent: false }))
          .response.status,
        400,
      );
      const booked = await request({ ...prospect, slot: prospectSlot });
      assert.equal(booked.response.status, 200);
      // Le rendez-vous apparaît dans le Google Agenda du gérant, sans l'intention.
      const prospectEvent = googleEventId(booked.data.reference);
      await eventually(() => googleEvents.has(prospectEvent), "événement Google non créé");
      const googleEvent = googleEvents.get(prospectEvent);
      assert.equal(googleEvent.summary, "Appel découverte · Camille Martin");
      assert.equal(googleEvent.start.dateTime, new Date(booked.data.starts).toISOString());
      assert.ok(googleEvent.description.includes(prospect.phone));
      assert.ok(googleEvent.description.includes("https://synego.example.test/connexion"));
      assert.ok(!googleEvent.description.includes(prospect.intention));
      // Même demande renvoyée (double clic, réseau) : la réservation est confirmée à nouveau,
      // pas refusée comme « créneau déjà réservé ». Une autre personne reste refusée.
      const confirmation = await mailTo("camille@example.test", "est confirmé");
      assert.ok(confirmation.subject.startsWith("Votre rendez-vous du "));
      assert.ok(confirmation.html.includes("https://calendar.google.com/calendar/render?"));
      assert.ok(confirmation.text.includes("Ajouter à Google Agenda : https://calendar.google.com/"));
      assert.ok(confirmation.text.includes("contactez Youcef au moins 24 h avant"));
      assert.ok(!confirmation.text.includes("répondez"));
      const adminNotice = await mailTo("gerant@example.test", "Nouveau rendez-vous · Appel découverte · Camille Martin");
      assert.ok(adminNotice.text.includes(prospect.phone) && adminNotice.text.includes("Prospect (sans compte)"));
      // Pas de Reply-To vers le client (autre domaine) : son adresse est dans le corps.
      // Pas de signature « Youcef » au gérant.
      assert.notEqual(adminNotice.replyTo, prospect.email);
      assert.ok(adminNotice.text.includes(prospect.email));
      assert.ok(!adminNotice.text.includes("À très bientôt"));
      for (const mail of [confirmation, adminNotice])
        assert.ok(!mail.html.includes(prospect.intention) && !mail.text.includes(prospect.intention));
      const repeatedProspect = await request({ ...prospect, slot: prospectSlot });
      assert.equal(repeatedProspect.response.status, 200);
      assert.equal(repeatedProspect.data.reference, booked.data.reference);
      // Une demande reçue deux fois n'envoie pas une deuxième confirmation.
      await pause(500);
      assert.equal(mailsTo("camille@example.test", "est confirmé").length, 1);
      const otherProspect = await request({
        ...prospect,
        slot: prospectSlot,
        email: "quelqu-un-d-autre@example.test",
      });
      assert.equal(otherProspect.response.status, 409);
      assert.equal(otherProspect.data.code, "slotTaken");
      const adminView = (await request("", admin, "GET")).data;
      assert.equal(adminView.appointments[0].phone, prospect.phone);
      assert.equal(adminView.appointments[0].intention, prospect.intention);
      const later = starts + 2 * 3600000;
      assert.equal(
        (
          await request(
            { action: "add-slot", starts: later, ends: later + 3600000, minutes: 60 },
            admin,
          )
        ).response.status,
        200,
      );
      assert.equal(
        (
          await request(
            {
              action: "add-slot",
              starts: later + 10000,
              ends: later + 3610000,
              minutes: 60,
            },
            admin,
          )
        ).response.status,
        409,
      );
      // Une plage de 3 h découpée en créneaux de 45 min donne 4 créneaux ;
      // la même plage ajoutée une seconde fois est entièrement ignorée.
      const range = starts + 2 * 86400000;
      const split = await request(
        { action: "add-slot", starts: range, ends: range + 3 * 3600000, minutes: 45 },
        admin,
      );
      assert.equal(split.response.status, 200);
      assert.deepEqual([split.data.added, split.data.skipped], [4, 0]);
      const partial = await request(
        {
          action: "add-slot",
          starts: range + 2 * 3600000,
          ends: range + 5 * 3600000,
          minutes: 60,
        },
        admin,
      );
      assert.deepEqual([partial.data.added, partial.data.skipped], [2, 1]);
      assert.equal(
        (
          await request(
            { action: "add-slot", starts: range, ends: range + 3 * 3600000, minutes: 45 },
            admin,
          )
        ).response.status,
        409,
      );
      assert.equal(
        (
          await request(
            { action: "add-slot", starts: range, ends: range + 20 * 3600000, minutes: 60 },
            admin,
          )
        ).response.status,
        400,
      );
      const past = await request(
        { action: "add-slot", starts: Date.now() - 3600000, ends: Date.now() + 3600000, minutes: 60 },
        admin,
      );
      assert.equal(past.response.status, 400);
      assert.equal(past.data.code, "slotPast");
      assert.equal(past.data.field, "starts");
      const available = await request("?action=slots&type=audit", "", "GET");
      const slot = available.data.slots[0].id;
      const competing = await Promise.all(
        [alice, bob].map((cookie) =>
          request(
            {
              action: "reserve",
              type: "audit",
              format: "visio",
              slot,
              phone: "06 00 00 00 00",
              intention: "Préparer un séminaire.",
              consent: true,
            },
            cookie,
          ),
        ),
      );
      assert.deepEqual(
        competing.map((value) => value.response.status).sort(),
        [200, 409],
      );
      // Ticket : créneau créé par le gérant, réservé par un client dont la demande part deux fois.
      const doubleStart = starts + 6 * 86400000;
      assert.equal(
        (
          await request(
            { action: "add-slot", starts: doubleStart, ends: doubleStart + 3600000, minutes: 60 },
            admin,
          )
        ).response.status,
        200,
      );
      const doubleSlot = (await request("?action=slots&type=suivi", registeredSession, "GET")).data.slots.find(
        (item) => item.starts === doubleStart,
      ).id;
      const doubleBooking = {
        action: "reserve",
        type: "suivi",
        format: "visio",
        slot: doubleSlot,
        phone: "06 11 22 33 44",
        intention: "Séance réservée deux fois par erreur.",
        consent: true,
      };
      const twice = await Promise.all([
        request(doubleBooking, registeredSession),
        request(doubleBooking, registeredSession),
      ]);
      assert.deepEqual(
        twice.map((value) => value.response.status),
        [200, 200],
      );
      assert.equal(twice[0].data.reference, twice[1].data.reference);
      const again = await request(doubleBooking, registeredSession);
      assert.equal(again.response.status, 200);
      assert.equal(again.data.reference, twice[0].data.reference);
      assert.equal(
        (await request("", registeredSession, "GET")).data.appointments.filter(
          (item) => item.starts === doubleStart,
        ).length,
        1,
      );
      // Un autre client voit toujours le créneau comme pris.
      const stolen = await request({ ...doubleBooking, phone: "06 00 00 00 00" }, bob);
      assert.equal(stolen.response.status, 409);
      assert.equal(stolen.data.code, "slotTaken");
      assert.ok(
        !(await request("?action=slots&type=audit", "", "GET")).data.slots.some(
          (item) => item.id === slot,
        ),
      );
      const a = (await request("", alice, "GET")).data,
        b = (await request("", bob, "GET")).data;
      assert.equal(a.appointments.length + b.appointments.length, 1);
      assert.equal(
        (await request({ action: "remove-slot", id: slot }, admin)).response
          .status,
        409,
      );
      assert.equal(
        (
          await request({
            action: "reserve",
            ...prospect,
            type: "suivi",
            slot,
          })
        ).response.status,
        401,
      );
      // Séance de suivi (1 h) : réservée aux clients connectés.
      const individualSlot = (
        await request("?action=slots&type=suivi", alice, "GET")
      ).data.slots[0].id;
      assert.equal(
        (
          await request(
            {
              action: "reserve",
              type: "suivi",
              format: "visio",
              slot: individualSlot,
              phone: "06 11 22 33 44",
              intention: "Poursuivre l’accompagnement.",
              consent: true,
            },
            alice,
          )
        ).response.status,
        200,
      );
      // Gestion des rendez-vous par le client : déplacer et annuler, jusqu'à 24 h avant.
      const aliceAppointment = (await request("", alice, "GET")).data.appointments.find(
        (item) => item.type === "suivi",
      );
      assert.equal(aliceAppointment.status, "confirmed");
      assert.equal(aliceAppointment.changeable, true);
      assert.equal(
        (await request({ action: "cancel", id: aliceAppointment.id }, bob)).response.status,
        404,
      );
      assert.equal(
        (await request({ action: "cancel", id: aliceAppointment.id })).response.status,
        401,
      );
      assert.equal(
        (await request({ action: "cancel", id: aliceAppointment.id }, admin)).response.status,
        401,
      );
      // Un créneau de 45 minutes ne convient pas à une séance d'une heure.
      const shortSlot = (await request("?action=slots&type=audit", "", "GET")).data.slots.find(
        (item) => item.ends - item.starts < 3600000,
      );
      assert.equal(
        (
          await request(
            { action: "reschedule", id: aliceAppointment.id, slot: shortSlot.id },
            alice,
          )
        ).response.status,
        409,
      );
      const otherSlot = (
        await request("?action=slots&type=suivi", alice, "GET")
      ).data.slots.find((item) => item.id !== individualSlot);
      const moved = await request(
        { action: "reschedule", id: aliceAppointment.id, slot: otherSlot.id },
        alice,
      );
      assert.equal(moved.response.status, 200);
      assert.equal(moved.data.starts, otherSlot.starts);
      // Le déplacement est reporté dans Google Agenda.
      const aliceEvent = googleEventId(aliceAppointment.id);
      await eventually(
        () =>
          googleEvents.get(aliceEvent)?.start.dateTime === new Date(otherSlot.starts).toISOString(),
        "déplacement non reporté dans Google",
      );
      // L'ancien créneau redevient réservable.
      assert.ok(
        (await request("?action=slots&type=suivi", alice, "GET")).data.slots.some(
          (item) => item.id === individualSlot,
        ),
      );
      assert.equal(
        (await request({ action: "cancel", id: aliceAppointment.id }, alice)).response.status,
        200,
      );
      const movedMail = await mailTo("alice@example.test", "est déplacé");
      assert.ok(movedMail.text.includes("Ancien créneau : "));
      await mailTo("gerant@example.test", "Rendez-vous déplacé · Alice ·");
      await mailTo("alice@example.test", "est annulé");
      await mailTo("gerant@example.test", "Rendez-vous annulé · Alice ·");
      // L'annulation supprime l'événement Google.
      await eventually(
        () =>
          !googleEvents.has(aliceEvent) &&
          googleCalls.some((call) => call.method === "DELETE" && call.path.endsWith(aliceEvent)),
        "annulation non reportée dans Google",
      );
      // Lien d'abonnement : secret, rendez-vous confirmés uniquement, sans l'intention.
      assert.equal((await fetch(origin + "/api/agenda/" + "x".repeat(48))).status, 404);
      const feed = await fetch(origin + "/api/agenda/" + feedToken);
      assert.equal(feed.status, 200);
      assert.match(feed.headers.get("content-type"), /^text\/calendar/);
      const ics = await feed.text();
      assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
      assert.ok(ics.includes(`UID:rendez-vous-${booked.data.reference}@synego`));
      assert.ok(ics.includes("Camille Martin"));
      assert.ok(!ics.includes(prospect.intention));
      assert.ok(!ics.includes(`UID:rendez-vous-${aliceAppointment.id}@synego`));
      const agenda = (await request("", admin, "GET")).data.agenda;
      assert.deepEqual(agenda, { feedPath: "/api/agenda/" + feedToken, googleSync: true });
      assert.equal((await request("", alice, "GET")).data.agenda, undefined);
      const cancelledTwice = await request({ action: "cancel", id: aliceAppointment.id }, alice);
      assert.equal(cancelledTwice.response.status, 409);
      assert.equal(cancelledTwice.data.code, "alreadyCancelled");
      assert.ok(
        (await request("?action=slots&type=suivi", alice, "GET")).data.slots.some(
          (item) => item.id === otherSlot.id,
        ),
      );
      const afterCancel = (await request("", alice, "GET")).data.appointments.find(
        (item) => item.id === aliceAppointment.id,
      );
      assert.deepEqual([afterCancel.status, afterCancel.changeable], ["cancelled", false]);
      assert.equal(
        (await request("", admin, "GET")).data.appointments.find(
          (item) => item.id === aliceAppointment.id,
        ).status,
        "cancelled",
      );
      // Moins de 24 h avant le rendez-vous : annulation et déplacement refusés.
      const soon = Date.now() + 2 * 3600000;
      for (const offset of [0, 2 * 3600000])
        assert.equal(
          (
            await request(
              {
                action: "add-slot",
                starts: soon + offset,
                ends: soon + offset + 3600000,
                minutes: 60,
              },
              admin,
            )
          ).response.status,
          200,
        );
      const soonSlots = (await request("?action=slots&type=suivi", bob, "GET")).data.slots
        .filter((item) => item.starts - Date.now() < 86400000)
        .map((item) => item.id);
      assert.equal(soonSlots.length, 2);
      const session = (slotId) => ({
        action: "reserve",
        type: "suivi",
        format: "visio",
        slot: slotId,
        phone: "06 00 00 00 00",
        intention: "Séance de test.",
        consent: true,
      });
      assert.equal((await request(session(soonSlots[0]), bob)).response.status, 200);
      const bobSoon = (await request("", bob, "GET")).data.appointments.find(
        (item) => item.type === "suivi",
      );
      assert.equal(bobSoon.changeable, false);
      const tooLate = await request({ action: "cancel", id: bobSoon.id }, bob);
      assert.equal(tooLate.response.status, 409);
      assert.equal(tooLate.data.code, "tooLateToChange");
      // Déplacement vers un créneau situé à moins de 24 h : refusé.
      assert.equal((await request(session(individualSlot), alice)).response.status, 200);
      const aliceAgain = (await request("", alice, "GET")).data.appointments.find(
        (item) => item.status === "confirmed" && item.type === "suivi",
      );
      const tooSoon = await request(
        { action: "reschedule", id: aliceAgain.id, slot: soonSlots[1] },
        alice,
      );
      assert.equal(tooSoon.response.status, 409);
      assert.equal(tooSoon.data.code, "slotTooSoon");
      // Profil : nom et téléphone modifiables par le client.
      const badPhone = await request(
        { action: "update-profile", name: "Alice Martin", phone: "abc" },
        alice,
      );
      assert.equal(badPhone.response.status, 400);
      assert.equal(badPhone.data.field, "phone");
      assert.equal(
        (
          await request(
            { action: "update-profile", name: "Alice Martin", phone: "07 00 00 00 00" },
            alice,
          )
        ).response.status,
        200,
      );
      const profile = (await request("", alice, "GET")).data.user;
      assert.deepEqual(
        [profile.name, profile.phone, profile.email],
        ["Alice Martin", "07 00 00 00 00", "alice@example.test"],
      );
      const clients = (await request("", admin, "GET")).data.clients;
      const aliceId = clients.find((client) => client.email === "alice@example.test").id;
      const pdf = new FormData();
      pdf.set("title", "Document privé Alice");
      pdf.append("user_ids", String(aliceId));
      pdf.set(
        "file",
        new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
        "support.pdf",
      );
      assert.equal((await request(pdf, admin)).response.status, 200);
      const documents = (await request("", alice, "GET")).data.documents;
      assert.equal(documents.length, 1);
      assert.equal((await request("", bob, "GET")).data.documents.length, 0);
      const documentUrl = "?action=document&id=" + documents[0].id;
      assert.equal(
        (await request(documentUrl, alice, "GET")).response.status,
        200,
      );
      assert.equal(
        (await request(documentUrl, bob, "GET")).response.status,
        404,
      );
      assert.equal(
        (await request(documentUrl, "", "GET")).response.status,
        401,
      );
      // Partage avec plusieurs clients choisis, ou avec tous les clients.
      const bobClientId = clients.find((client) => client.email === "bob@example.test").id;
      const sharePdf = (title, recipients) => {
        const form = new FormData();
        form.set("title", title);
        if (recipients === "all") form.set("all_clients", "true");
        else for (const recipient of recipients) form.append("user_ids", String(recipient));
        form.set("file", new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }), "partage.pdf");
        return request(form, admin);
      };
      const noRecipient = await sharePdf("Sans destinataire", []);
      assert.equal(noRecipient.response.status, 400);
      assert.equal(noRecipient.data.field, "recipients");
      assert.equal((await sharePdf("Client inconnu", [aliceId, 999999])).response.status, 404);
      // Le gérant n'est pas un client : il ne peut pas être destinataire.
      // (Base de test neuve : le compte gérant est le premier créé, donc l'id 1.)
      assert.equal((await sharePdf("Destinataire gérant", [1])).response.status, 404);
      // Doublons ignorés : Alice n'est enregistrée qu'une fois.
      assert.equal((await sharePdf("Alice et Bob", [aliceId, bobClientId, aliceId])).response.status, 200);
      const titlesOf = async (cookie) =>
        (await request("", cookie, "GET")).data.documents.map((item) => item.title).sort();
      assert.deepEqual(await titlesOf(alice), ["Alice et Bob", "Document privé Alice"]);
      assert.deepEqual(await titlesOf(bob), ["Alice et Bob"]);
      assert.deepEqual(await titlesOf(registeredSession), []);
      // Le client ne voit pas la liste des autres destinataires ; le gérant, si.
      const aliceShared = (await request("", alice, "GET")).data.documents.find(
        (item) => item.title === "Alice et Bob",
      );
      assert.equal(aliceShared.recipients, undefined);
      const adminShared = (await request("", admin, "GET")).data.documents.find(
        (item) => item.title === "Alice et Bob",
      );
      assert.deepEqual(
        [adminShared.all_clients, [...adminShared.recipients].sort((a, b) => a - b)],
        [false, [aliceId, bobClientId].sort((a, b) => a - b)],
      );
      assert.equal(
        (await request("?action=document&id=" + aliceShared.id, registeredSession, "GET")).response
          .status,
        404,
      );
      assert.equal((await sharePdf("Pour tous", "all")).response.status, 200);
      assert.deepEqual(await titlesOf(registeredSession), ["Pour tous"]);
      assert.ok((await titlesOf(bob)).includes("Pour tous"));
      // Les documents ajoutés ici ne doivent pas perturber la suite : on les retire.
      for (const item of (await request("", admin, "GET")).data.documents)
        if (["Alice et Bob", "Pour tous"].includes(item.title))
          assert.equal(
            (await request({ action: "remove-document", id: item.id }, admin)).response.status,
            200,
          );
      // Espace de tickets : une demande est déposée, suivie, puis clôturée.
      assert.equal(
        (await request({ action: "create-ticket", subject: "Sans compte", message: "…" }))
          .response.status,
        401,
      );
      const emptyTicket = await request(
        { action: "create-ticket", subject: "Facture", message: "  " },
        alice,
      );
      assert.equal(emptyTicket.response.status, 400);
      assert.equal(emptyTicket.data.field, "message");
      const createdTicket = await request(
        {
          action: "create-ticket",
          subject: "Accès au document",
          message: "Je n'arrive pas à ouvrir le PDF partagé.",
        },
        alice,
      );
      assert.equal(createdTicket.response.status, 200);
      const ticketId = createdTicket.data.reference;
      const ticketNotice = await mailTo("gerant@example.test", "Nouvelle demande de support · Accès au document");
      assert.ok(ticketNotice.text.includes("Je n'arrive pas à ouvrir le PDF partagé."));
      assert.equal(
        (
          await request(
            { action: "create-ticket", subject: "Question de Bob", message: "Bonjour." },
            bob,
          )
        ).response.status,
        200,
      );
      // Chaque client ne voit que ses demandes, sans pouvoir les traiter.
      const aliceTickets = (await request("", alice, "GET")).data.tickets;
      assert.deepEqual(
        aliceTickets.map((ticket) => [ticket.subject, ticket.status]),
        [["Accès au document", "open"]],
      );
      assert.equal(aliceTickets[0].email, undefined);
      assert.deepEqual(
        (await request("", bob, "GET")).data.tickets.map((ticket) => ticket.subject),
        ["Question de Bob"],
      );
      for (const action of [
        { action: "reply-ticket", id: ticketId, message: "Je me réponds." },
        { action: "ticket-status", id: ticketId, status: "closed" },
      ])
        assert.equal((await request(action, bob)).response.status, 403);
      // Le gérant voit toutes les demandes, répond (la demande passe en cours) puis clôture.
      const adminTickets = (await request("", admin, "GET")).data.tickets;
      assert.equal(adminTickets.length, 2);
      assert.equal(
        adminTickets.find((ticket) => ticket.id === ticketId).email,
        "alice@example.test",
      );
      assert.equal(
        (await request({ action: "reply-ticket", id: 999999, message: "?" }, admin))
          .response.status,
        404,
      );
      assert.equal(
        (
          await request(
            { action: "ticket-status", id: ticketId, status: "archivé" },
            admin,
          )
        ).response.status,
        400,
      );
      assert.equal(
        (
          await request(
            {
              action: "reply-ticket",
              id: ticketId,
              message: "Le document a été partagé à nouveau.",
            },
            admin,
          )
        ).response.status,
        200,
      );
      const replyMail = await mailTo("alice@example.test", "Réponse à votre demande « Accès au document »");
      assert.ok(replyMail.text.includes("> Le document a été partagé à nouveau."));
      const followed = (await request("", alice, "GET")).data.tickets.find((ticket) => ticket.id === ticketId);
      assert.equal(followed.status, "in_progress");
      assert.deepEqual(
        followed.replies.map((reply) => reply.message),
        ["Le document a été partagé à nouveau."],
      );
      assert.equal(
        (await request({ action: "ticket-status", id: ticketId, status: "closed" }, admin))
          .response.status,
        200,
      );
      const closed = (await request("", alice, "GET")).data.tickets[0];
      assert.equal(closed.status, "closed");
      assert.ok(closed.closedAt);
      const lateReply = await request(
        { action: "reply-ticket", id: ticketId, message: "Encore une chose." },
        admin,
      );
      assert.equal(lateReply.response.status, 409);
      assert.equal(lateReply.data.code, "ticketClosed");
      // Contenu saisi sur le site : échappé dans le HTML des e-mails.
      assert.equal(
        (
          await request(
            { action: "create-ticket", subject: "Balise <script>x</script>", message: "<b>gras</b>" },
            alice,
          )
        ).response.status,
        200,
      );
      const escaped = await mailTo("gerant@example.test", "Balise <script>");
      assert.ok(!escaped.html.includes("<script>") && !escaped.html.includes("<b>gras</b>"));
      assert.ok(escaped.html.includes("&lt;script&gt;") && escaped.html.includes("&lt;b&gt;gras&lt;/b&gt;"));
      // Aucun e-mail n'a de Reply-To sur un autre domaine que celui de l'expéditeur.
      assert.ok(mails.length > 0);
      assert.ok(mails.every((mail) => !mail.replyTo || mail.replyTo.toLowerCase().endsWith("@abdu.fr")));
      // Parcours : un document se débloque après un nombre de séances réalisées.
      const bobId = clients.find((client) => client.email === "bob@example.test").id;
      const share = (title, requiredSessions) => {
        const form = new FormData();
        form.set("title", title);
        form.append("user_ids", String(bobId));
        form.set("required_sessions", String(requiredSessions));
        form.set(
          "file",
          new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
          "parcours.pdf",
        );
        return request(form, admin);
      };
      const invalidThreshold = await share("Seuil négatif", -1);
      assert.equal(invalidThreshold.response.status, 400);
      assert.equal(invalidThreshold.data.field, "required_sessions");
      assert.equal((await share("Après la première séance", 1)).response.status, 200);
      let bobView = (await request("", bob, "GET")).data;
      assert.equal(bobView.completedSessions, 0);
      const stepDocument = bobView.documents.find(
        (item) => item.title === "Après la première séance",
      );
      assert.deepEqual([stepDocument.required_sessions, stepDocument.unlocked], [1, false]);
      const stepUrl = "?action=document&id=" + stepDocument.id;
      const locked = await request(stepUrl, bob, "GET");
      assert.equal(locked.response.status, 403);
      assert.equal(locked.data.code, "documentLocked");
      // Le gérant ouvre tous les documents, verrouillés ou non.
      assert.equal((await request(stepUrl, admin, "GET")).response.status, 200);
      // Une séance à venir ne peut pas être marquée réalisée : on la place dans le passé.
      assert.equal(
        (await request({ action: "complete", id: bobSoon.id }, admin)).response.status,
        409,
      );
      const testDatabase = new pg.Client({ connectionString: databaseUrl.toString() });
      await testDatabase.connect();
      await testDatabase.query(
        "UPDATE appointments SET starts = starts - interval '1 day', ends = ends - interval '1 day' WHERE id = $1",
        [bobSoon.id],
      );
      await testDatabase.end();
      assert.equal(
        (await request({ action: "complete", id: bobSoon.id }, admin)).response.status,
        200,
      );
      bobView = (await request("", bob, "GET")).data;
      assert.equal(bobView.completedSessions, 1);
      assert.equal(
        bobView.documents.find((item) => item.id === stepDocument.id).unlocked,
        true,
      );
      assert.equal((await request(stepUrl, bob, "GET")).response.status, 200);
      // Corriger le statut de la séance reverrouille le document.
      assert.equal(
        (await request({ action: "complete", id: bobSoon.id }, admin)).response.status,
        200,
      );
      assert.equal((await request(stepUrl, bob, "GET")).response.status, 403);
      assert.equal(
        (
          await request(
            newClient("Intrus"),
            alice,
          )
        ).response.status,
        403,
      );
      assert.equal(
        (await request({ action: "toggle-client", id: aliceId }, admin))
          .response.status,
        200,
      );
      assert.equal((await request("", alice, "GET")).data.user, null);
      assert.equal(
        (
          await request({
            action: "login",
            email: "alice@example.test",
            password,
          })
        ).response.status,
        401,
      );
      // Mot de passe : l'ancien est exigé, les autres sessions du compte sont fermées.
      const newPassword = randomBytes(16).toString("hex");
      const wrongPassword = await request(
        { action: "change-password", currentPassword: "incorrect", password: newPassword },
        bob,
      );
      assert.equal(wrongPassword.response.status, 400);
      assert.equal(wrongPassword.data.field, "currentPassword");
      assert.equal(
        (
          await request(
            { action: "change-password", currentPassword: password, password: "court" },
            bob,
          )
        ).response.status,
        400,
      );
      const otherBobSession = await login("bob@example.test");
      assert.equal(
        (
          await request(
            { action: "change-password", currentPassword: password, password: newPassword },
            bob,
          )
        ).response.status,
        200,
      );
      assert.equal((await request("", otherBobSession, "GET")).data.user, null);
      assert.equal((await request("", bob, "GET")).data.user.role, "client");
      assert.equal(
        (await request({ action: "login", email: "bob@example.test", password })).response.status,
        401,
      );
      assert.equal(
        (
          await request({
            action: "login",
            email: "bob@example.test",
            password: newPassword,
          })
        ).response.status,
        200,
      );
      // Mot de passe perdu : le gérant en génère un nouveau, provisoire ; les sessions sont fermées.
      assert.equal(
        (await request({ action: "reset-client-password", id: bobId }, bob)).response.status,
        403,
      );
      const reset = await request({ action: "reset-client-password", id: bobId }, admin);
      assert.equal(reset.response.status, 200);
      assert.match(reset.data.password, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
      assert.equal((await request("", bob, "GET")).data.user, null);
      assert.equal(
        (await request({ action: "login", email: "bob@example.test", password: newPassword }))
          .response.status,
        401,
      );
      const afterReset = await request({
        action: "login",
        email: "bob@example.test",
        password: reset.data.password,
      });
      assert.equal(afterReset.response.status, 200);
      const bobReset = afterReset.response.headers.get("set-cookie").split(";")[0];
      assert.equal((await request("", bobReset, "GET")).data.user.passwordTemporary, true);
      assert.equal(
        (await request({ action: "reset-client-password", id: 999999 }, admin)).response.status,
        404,
      );
      assert.equal(
        (await request({ action: "logout" }, bobReset)).response.status,
        200,
      );
      assert.equal((await request("", bobReset, "GET")).data.user, null);

      // Mot de passe oublié : même réponse pour une adresse inconnue, sans e-mail.
      const forgot = (address) => request({ action: "forgot-password", email: address });
      assert.equal((await forgot("personne@example.test")).response.status, 200);
      assert.equal((await forgot("pas-une-adresse")).response.status, 400);
      assert.equal((await forgot("inscrit@example.test")).response.status, 200);
      const resetMail = await mailTo("inscrit@example.test", "Réinitialisez votre mot de passe");
      const resetToken = decodeURIComponent(resetMail.text.match(/token=(\S+)/)[1]);
      await pause(300);
      assert.equal(mailsTo("personne@example.test").length, 0);
      // Trois demandes au plus par quart d'heure : la quatrième ne part pas (réponse identique).
      for (let attempt = 0; attempt < 3; attempt++)
        assert.equal((await forgot("inscrit@example.test")).response.status, 200);
      await pause(500);
      assert.equal(mailsTo("inscrit@example.test", "Réinitialisez").length, 3);
      const resetWith = (token, newPassword) =>
        request({ action: "reset-password", token, password: newPassword });
      assert.equal((await resetWith(resetToken, "court")).response.status, 400);
      assert.equal((await resetWith("jeton-inconnu", "un-mot-de-passe-solide")).data.code, "resetInvalid");
      const chosen = randomBytes(12).toString("hex");
      const resetDone = await resetWith(resetToken, chosen);
      assert.equal(resetDone.response.status, 200);
      // Connecté directement ; l'ancienne session et l'ancien mot de passe ne valent plus rien.
      assert.equal(
        (await request("", resetDone.response.headers.get("set-cookie").split(";")[0], "GET")).data.user.email,
        "inscrit@example.test",
      );
      assert.equal((await request("", registeredSession, "GET")).data.user, null);
      assert.equal((await request({ action: "login", email: "inscrit@example.test", password })).response.status, 401);
      assert.equal(
        (await request({ action: "login", email: "inscrit@example.test", password: chosen })).response.status,
        200,
      );
      // Un lien ne sert qu'une fois.
      assert.equal((await resetWith(resetToken, chosen)).data.code, "resetInvalid");
      // Lien « choisir mon mot de passe » d'un compte créé par le gérant : valable pour Bob,
      // refusé pour Alice dont le compte a été désactivé.
      const tokenOf = (mail) => decodeURIComponent(mail.text.match(/token=(\S+)/)[1]);
      assert.equal((await resetWith(tokenOf(bobInvite), chosen)).response.status, 200);
      assert.equal((await resetWith(tokenOf(aliceInvite), chosen)).data.code, "resetInvalid");
      // Tous les e-mails ont une version texte, et la clé n'apparaît dans aucun d'eux.
      assert.ok(mails.every((mail) => mail.text && mail.html && !JSON.stringify(mail).includes(sendKey)));
    } finally {
      send.close();
      google.close();
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await maintenance.end();
    }
  },
);
