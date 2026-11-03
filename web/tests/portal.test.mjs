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
      // Les clients créent eux-mêmes leur compte ; le gérant ne peut plus le faire.
      assert.equal(
        (
          await request(
            {
              action: "create-client",
              name: "Créé par le gérant",
              email: "gerant-cree@example.test",
              password,
            },
            admin,
          )
        ).response.status,
        400,
      );
      const signUp = (name, extra = {}) =>
        request({
          action: "register",
          name,
          email: name.toLowerCase() + "@example.test",
          phone: "06 11 22 33 44",
          password,
          consent: true,
          ...extra,
        });
      assert.equal((await signUp("Alice", { consent: false })).response.status, 400);
      assert.equal(
        (await signUp("Alice", { password: "trop-court" })).response.status,
        400,
      );
      const registered = await signUp("Alice");
      assert.equal(registered.response.status, 200);
      const aliceSession = registered.response.headers
        .get("set-cookie")
        .split(";")[0];
      const aliceView = (await request("", aliceSession, "GET")).data;
      assert.equal(aliceView.user.role, "client");
      assert.equal(aliceView.user.phone, "06 11 22 33 44");
      assert.equal((await signUp("Alice")).response.status, 409);
      assert.equal((await signUp("Bob")).response.status, 200);
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
      assert.equal(
        (
          await request(
            {
              action: "create-client",
              name: "Intrus",
              email: "intrus@example.test",
              password,
            },
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
      assert.equal(
        (await request({ action: "logout" }, bob)).response.status,
        200,
      );
      assert.equal((await request("", bob, "GET")).data.user, null);
    } finally {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await maintenance.end();
    }
  },
);
