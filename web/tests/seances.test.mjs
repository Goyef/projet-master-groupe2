import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import pg from "pg";

// Préparation et compte rendu de séance : même mise en place que portal.test.mjs
// (base temporaire, serveur de production, faux Resend).
const adminUrl =
  process.env.TEST_DATABASE_URL ||
  "postgres://synego:synego@localhost:5432/synego";

test(
  "préparation, compte rendu, actions et isolation entre clients",
  { timeout: 60000 },
  async () => {
    const database = "synego_test_" + randomBytes(6).toString("hex");
    const maintenance = new pg.Client({ connectionString: adminUrl });
    await maintenance.connect();
    await maintenance.query(`CREATE DATABASE ${database}`);
    const databaseUrl = new URL(adminUrl);
    databaseUrl.pathname = "/" + database;
    const adminPassword = randomBytes(20).toString("hex");
    const port = Number(process.env.TEST_PORT) || 43127,
      origin = `http://127.0.0.1:${port}`;

    // Faux Resend : garde les e-mails reçus, sans rien envoyer.
    const sendKey = "re_test_" + randomBytes(16).toString("hex");
    const mails = [];
    const send = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      if (req.headers.authorization !== `Bearer ${sendKey}`) {
        res.writeHead(401);
        return res.end();
      }
      mails.push(JSON.parse(body));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: `resend-${mails.length}` }));
    });
    await new Promise((resolve) => send.listen(0, "127.0.0.1", resolve));
    const mailsTo = (address, subjectPart = "") =>
      mails.filter((mail) => mail.to.includes(address) && mail.subject.includes(subjectPart));
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function eventually(check, label) {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (check()) return;
        await pause(100);
      }
      assert.fail(label + "\n" + logs);
    }

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
          ADMIN_PASSWORD: adminPassword,
          // Pas de synchronisation Google ni de lien d'abonnement dans ce test.
          CALENDAR_FEED_TOKEN: "",
          GOOGLE_CALENDAR_ID: "",
          GOOGLE_SERVICE_ACCOUNT_EMAIL: "",
          GOOGLE_PRIVATE_KEY: "",
          RESEND_API_KEY: sendKey,
          RESEND_API_URL: `http://127.0.0.1:${send.address().port}/emails`,
          MAIL_FROM: "noreply@abdu.fr",
          MAIL_ADMIN_TO: "gerant@example.test",
          SITE_URL: "https://synego.example.test",
        },
        stdio: "pipe",
      },
    );
    let logs = "";
    server.stdout.on("data", (data) => (logs += data));
    server.stderr.on("data", (data) => (logs += data));

    async function request(data, cookie = "", method = "POST") {
      const response = await fetch(origin + "/api/portal" + (method === "GET" ? data : ""), {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(data) }),
      });
      return { status: response.status, data: await response.json() };
    }
    const view = async (cookie) => (await request("", cookie, "GET")).data;
    async function login(email, password) {
      const response = await fetch(origin + "/api/portal", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      assert.equal(response.status, 200, `connexion de ${email}`);
      return response.headers.get("set-cookie").split(";")[0];
    }
    const testDatabase = new pg.Client({ connectionString: databaseUrl.toString() });
    // Place un rendez-vous dans le passé (2 jours plus tôt que maintenant).
    const moveToPast = (id) =>
      testDatabase.query(
        "UPDATE appointments SET starts = now() - interval '2 days', ends = now() - interval '2 days' + interval '1 hour' WHERE id = $1",
        [id],
      );

    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          if ((await fetch(origin)).ok) break;
        } catch {}
        await pause(100);
      }
      const admin = await login("gerant@example.test", adminPassword);
      await testDatabase.connect();

      // Deux clients, chacun avec une séance de suivi à venir.
      const clients = {};
      for (const name of ["Alice", "Bob"]) {
        const email = name.toLowerCase() + "@example.test";
        const created = await request(
          { action: "create-client", name, email, phone: "06 11 22 33 44" },
          admin,
        );
        assert.equal(created.status, 200);
        clients[name] = await login(email, created.data.password);
      }
      const { alice, bob } = { alice: clients.Alice, bob: clients.Bob };
      const starts = Date.now() + 3 * 86400000 - (Date.now() % 3600000);
      assert.equal(
        (await request({ action: "add-slot", starts, ends: starts + 3 * 3600000, minutes: 60 }, admin)).status,
        200,
      );
      const slots = (await view(admin)).slots;
      const book = (cookie, slot, extra = {}) =>
        request(
          {
            action: "reserve",
            type: "suivi",
            slot: slot.id,
            format: "visio",
            phone: "06 11 22 33 44",
            intention: "Suivi",
            consent: true,
            ...extra,
          },
          cookie,
        );
      const aliceBooking = await book(alice, slots[0]);
      const bobBooking = await book(bob, slots[1]);
      assert.equal(aliceBooking.status, 200);
      assert.equal(bobBooking.status, 200);
      const aliceId = aliceBooking.data.reference;
      const bobId = bobBooking.data.reference;

      // --- Préparation ---------------------------------------------------------
      const preparation = "Je voudrais parler du sentiment de vide le dimanche soir.";
      const prepare = (cookie, id, text) => request({ action: "save-preparation", id, preparation: text }, cookie);
      assert.equal((await prepare(alice, aliceId, preparation)).status, 200);
      const tooLong = await prepare(alice, aliceId, "x".repeat(1001));
      assert.deepEqual([tooLong.status, tooLong.data.field], [400, "preparation"]);
      // Un autre client, le gérant ou un visiteur ne peuvent pas l'écrire.
      assert.equal((await prepare(bob, aliceId, "intrusion")).data.code, "appointmentNotFound");
      assert.equal((await prepare(admin, aliceId, "gérant")).status, 401);
      assert.equal((await prepare("", aliceId, "visiteur")).status, 401);
      assert.equal(
        (await view(alice)).sessionNotes.find((note) => note.appointmentId === aliceId).preparation,
        preparation,
      );
      // Isolation : Bob ne voit rien de la séance d'Alice ; le gérant voit la préparation.
      assert.deepEqual((await view(bob)).sessionNotes, []);
      assert.equal(
        (await view(admin)).sessionNotes.find((note) => note.appointmentId === aliceId).preparation,
        preparation,
      );
      // Bob efface sa préparation avec un texte vide.
      assert.equal((await prepare(bob, bobId, "Brouillon")).status, 200);
      assert.equal((await prepare(bob, bobId, "  ")).status, 200);
      assert.deepEqual((await view(bob)).sessionNotes, []);
      // Une fois la séance commencée, la préparation n'est plus modifiable.
      await moveToPast(aliceId);
      const closed = await prepare(alice, aliceId, "Trop tard");
      assert.deepEqual([closed.status, closed.data.code], [409, "preparationClosed"]);

      // --- Compte rendu (gérant seulement) ---------------------------------------
      const summary = "Nous avons identifié les moments où le vide revient. Confidentiel.";
      const report = (cookie, id, extra = {}) =>
        request(
          {
            action: "session-report",
            id,
            summary,
            actions: [{ label: "Tenir un carnet le soir" }, { label: "Marcher 20 minutes" }],
            ...extra,
          },
          cookie,
        );
      // Pas avant que la séance soit marquée réalisée.
      assert.equal((await report(admin, aliceId)).data.code, "sessionReportUnavailable");
      assert.equal((await request({ action: "complete", id: aliceId }, admin)).status, 200);
      assert.equal((await report(alice, aliceId)).status, 403);
      assert.equal((await report(bob, aliceId)).status, 403);
      const tooMany = await report(admin, aliceId, {
        actions: Array.from({ length: 6 }, (_, index) => ({ label: `Action ${index}` })),
      });
      assert.deepEqual([tooMany.status, tooMany.data.field], [400, "actions"]);
      const longSummary = await report(admin, aliceId, { summary: "x".repeat(3001) });
      assert.deepEqual([longSummary.status, longSummary.data.field], [400, "summary"]);
      assert.equal((await report(admin, aliceId)).status, 200);

      // E-mail à la première publication, sans le contenu.
      await eventually(() => mailsTo("alice@example.test", "compte rendu").length, "e-mail de compte rendu non reçu");
      const reportMail = mailsTo("alice@example.test", "compte rendu")[0];
      assert.equal(reportMail.subject, "Votre compte rendu de séance est disponible");
      assert.ok(reportMail.html.includes("https://synego.example.test/connexion"));
      assert.ok(reportMail.text && reportMail.html);
      for (const secret of [summary, "Tenir un carnet", preparation])
        assert.ok(!mails.some((mail) => JSON.stringify(mail).includes(secret)), `contenu dans un e-mail : ${secret}`);

      // --- Actions cochées par le bon client seulement ----------------------------
      const aliceReport = (await view(alice)).sessionNotes.find((note) => note.appointmentId === aliceId).report;
      assert.equal(aliceReport.summary, summary);
      assert.deepEqual(
        aliceReport.actions.map((action) => [action.label, action.done]),
        [["Tenir un carnet le soir", false], ["Marcher 20 minutes", false]],
      );
      const [first, second] = aliceReport.actions;
      const tick = (cookie, id, done) => request({ action: "session-action", id, done }, cookie);
      assert.equal((await tick(alice, first.id, true)).status, 200);
      assert.equal((await tick(alice, first.id, "oui")).data.field, "done");
      assert.equal((await tick(bob, second.id, true)).data.code, "sessionActionNotFound");
      assert.equal((await tick(admin, second.id, true)).status, 401);
      assert.deepEqual((await view(bob)).sessionNotes, []);
      // Le gérant voit l'état des cases.
      const adminReport = (await view(admin)).sessionNotes.find((note) => note.appointmentId === aliceId).report;
      assert.deepEqual(adminReport.actions.map((action) => action.done), [true, false]);

      // Modification : l'action gardée conserve son état, l'autre est retirée, une nouvelle s'ajoute.
      const edited = await report(admin, aliceId, {
        summary: summary + " Complété.",
        actions: [{ id: first.id, label: "Tenir un carnet chaque soir" }, { label: "Appeler un ami" }],
      });
      assert.equal(edited.status, 200);
      // Une action d'une autre séance ne peut pas être reprise.
      assert.equal(
        (await report(admin, aliceId, { actions: [{ id: 999999, label: "Inconnue" }] })).data.code,
        "sessionActionNotFound",
      );
      const updated = (await view(alice)).sessionNotes.find((note) => note.appointmentId === aliceId).report;
      assert.deepEqual(
        updated.actions.map((action) => [action.label, action.done]),
        [["Tenir un carnet chaque soir", true], ["Appeler un ami", false]],
      );
      assert.ok(updated.summary.endsWith("Complété."));
      // Pas de second e-mail pour une modification.
      await pause(500);
      assert.equal(mailsTo("alice@example.test", "compte rendu").length, 1);

      // --- Rendez-vous sans compte : pas de compte rendu ------------------------------
      const prospect = await book("", slots[2], {
        type: "vente",
        firstName: "Paul",
        lastName: "Prospect",
        email: "paul@example.test",
      });
      assert.equal(prospect.status, 200);
      await moveToPast(prospect.data.reference);
      assert.equal((await request({ action: "complete", id: prospect.data.reference }, admin)).status, 200);
      assert.equal((await report(admin, prospect.data.reference)).data.code, "sessionReportUnavailable");

      // Supprimer le rendez-vous supprime aussi son compte rendu et ses actions.
      assert.equal((await request({ action: "owner-delete", id: aliceId, notify: false }, admin)).status, 200);
      const remaining = await testDatabase.query(
        "SELECT (SELECT count(*) FROM session_notes)::int AS notes, (SELECT count(*) FROM session_actions)::int AS actions",
      );
      assert.deepEqual(remaining.rows[0], { notes: 0, actions: 0 });
    } finally {
      send.close();
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      await testDatabase.end().catch(() => {});
      await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await maintenance.end();
    }
  },
);
