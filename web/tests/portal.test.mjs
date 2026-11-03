import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";

// Base Postgres d'administration : celle de docker-compose.yml par défaut.
const adminUrl =
  process.env.TEST_DATABASE_URL ||
  "postgres://synego:synego@localhost:5432/synego";

test(
  "réservation, comptes et isolation des documents",
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
    const port = 43127,
      origin = `http://127.0.0.1:${port}`;
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
          ADMIN_EMAIL: "gerant@example.test",
          ADMIN_PASSWORD: password,
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
      // Les comptes clients sont créés par le gérant ; l'inscription libre n'existe plus.
      const newClient = (name, extra = {}) => ({
        action: "create-client",
        name,
        email: name.toLowerCase() + "@example.test",
        phone: "06 11 22 33 44",
        ...extra,
      });
      assert.equal((await request(newClient("Visiteur"))).response.status, 403);
      const signUp = await request({
        ...newClient("Inscrit"),
        action: "register",
        password,
        consent: true,
      });
      // Action supprimée : traitée comme une action gérant, donc refusée à un visiteur.
      assert.equal(signUp.response.status, 403);
      assert.equal(signUp.response.headers.get("set-cookie"), null);
      const adminSignUp = await request(
        { ...newClient("Inscrit"), action: "register", password, consent: true },
        admin,
      );
      assert.equal(adminSignUp.data.code, "unknownAction");
      assert.equal(
        (await request({ action: "login", email: "inscrit@example.test", password }))
          .response.status,
        401,
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
      assert.notEqual(createdBob.data.password, created.data.password);
      const listed = (await request("", admin, "GET")).data.clients;
      assert.deepEqual(
        listed.map((client) => [client.email, client.passwordTemporary, "password" in client]),
        [
          ["alice@example.test", true, false],
          ["bob@example.test", true, false],
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
      pdf.set("user_id", String(aliceId));
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
      // Parcours : un document se débloque après un nombre de séances réalisées.
      const bobId = clients.find((client) => client.email === "bob@example.test").id;
      const share = (title, requiredSessions) => {
        const form = new FormData();
        form.set("title", title);
        form.set("user_id", String(bobId));
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
    } finally {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await maintenance.end();
    }
  },
);
