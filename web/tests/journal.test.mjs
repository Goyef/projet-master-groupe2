import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";

// Base Postgres d'administration : celle de docker-compose.yml par défaut.
const adminUrl =
  process.env.TEST_DATABASE_URL ||
  "postgres://synego:synego@localhost:5432/synego";

// Jour de Paris (« AAAA-MM-JJ »), comme le serveur.
const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

test(
  "journal d'humeur : entrée du jour, isolation entre clients, accès gérant et visiteur",
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
          // Aucun e-mail réel : sans clé, l'envoi est simplement ignoré.
          RESEND_API_KEY: "",
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
          "Accept-Language": "fr",
          ...(cookie ? { Cookie: cookie } : {}),
          ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(data) }),
      });
      return { response, data: await response.json() };
    }
    const sessionOf = (result) => result.response.headers.get("set-cookie").split(";")[0];
    const journal = async (cookie) => (await request("", cookie, "GET")).data.mood;
    const register = async (name) => {
      const result = await request({
        action: "register",
        name,
        email: name.toLowerCase() + "@example.test",
        phone: "06 11 22 33 44",
        password,
        consent: true,
      });
      assert.equal(result.response.status, 200, logs);
      return sessionOf(result);
    };
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          if ((await fetch(origin)).ok) break;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const today = parisToday();

      // Visiteur : ni lecture ni écriture.
      const anonymous = await request({ action: "save-mood", mood: 3 });
      assert.equal(anonymous.response.status, 401);
      assert.equal(anonymous.data.code, "loginRequired");
      assert.equal((await request({ action: "delete-mood", id: 1 })).response.status, 401);
      const visitorView = (await request("", "", "GET")).data;
      assert.deepEqual(visitorView, { user: null });

      const alice = await register("Alice");
      const bob = await register("Bob");
      assert.deepEqual(await journal(alice), []);

      // Validation : niveau 1 à 5, note de 500 caractères au plus.
      for (const mood of [0, 6, 2.5, "3", null]) {
        const invalid = await request({ action: "save-mood", mood }, alice);
        assert.equal(invalid.response.status, 400, String(mood));
        assert.deepEqual([invalid.data.code, invalid.data.field], ["moodInvalid", "mood"]);
      }
      const tooLong = await request({ action: "save-mood", mood: 3, note: "x".repeat(501) }, alice);
      assert.deepEqual([tooLong.response.status, tooLong.data.field], [400, "note"]);
      assert.equal(
        (await request({ action: "save-mood", mood: 3, note: "x".repeat(500) }, alice)).response.status,
        200,
      );

      // Une entrée par jour : enregistrer à nouveau remplace celle du jour.
      const first = await request({ action: "save-mood", mood: 2, note: "  Journée lourde  " }, alice);
      assert.deepEqual([first.response.status, first.data.day], [200, today]);
      let entries = await journal(alice);
      assert.equal(entries.length, 1);
      assert.deepEqual([entries[0].day, entries[0].mood, entries[0].note], [today, 2, "Journée lourde"]);
      assert.ok(!("userId" in entries[0]));
      const entryId = entries[0].id;
      assert.equal((await request({ action: "save-mood", mood: 4, note: "" }, alice)).response.status, 200);
      entries = await journal(alice);
      assert.deepEqual(
        entries.map((entry) => [entry.id, entry.mood, entry.note]),
        [[entryId, 4, null]],
      );

      // Isolation : Bob ne voit ni ne modifie le journal d'Alice.
      assert.deepEqual(await journal(bob), []);
      assert.equal((await request({ action: "save-mood", mood: 5, note: "Grand soleil" }, bob)).response.status, 200);
      const bobEntries = await journal(bob);
      assert.deepEqual(bobEntries.map((entry) => entry.mood), [5]);
      const foreignEdit = await request({ action: "save-mood", id: entryId, mood: 1 }, bob);
      assert.deepEqual([foreignEdit.response.status, foreignEdit.data.code], [404, "moodNotFound"]);
      const foreignDelete = await request({ action: "delete-mood", id: entryId }, bob);
      assert.deepEqual([foreignDelete.response.status, foreignDelete.data.code], [404, "moodNotFound"]);
      assert.deepEqual((await journal(alice)).map((entry) => entry.mood), [4]);

      // Gérant : voit le journal de chaque client (avec son compte), sans pouvoir l'écrire.
      const adminLogin = await request({ action: "login", email: "gerant@example.test", password });
      const admin = sessionOf(adminLogin);
      const adminView = (await request("", admin, "GET")).data;
      const clientId = (email) => adminView.clients.find((client) => client.email === email).id;
      assert.deepEqual(
        adminView.mood
          .map((entry) => [entry.userId, entry.day, entry.mood, entry.note])
          .sort((a, b) => a[0] - b[0]),
        [
          [clientId("alice@example.test"), today, 4, null],
          [clientId("bob@example.test"), today, 5, "Grand soleil"],
        ].sort((a, b) => a[0] - b[0]),
      );
      const adminWrite = await request({ action: "save-mood", mood: 3 }, admin);
      assert.deepEqual([adminWrite.response.status, adminWrite.data.code], [403, "moodClientOnly"]);
      assert.equal((await request({ action: "delete-mood", id: entryId }, admin)).response.status, 403);

      // Modification puis suppression d'une entrée par son auteur.
      const edited = await request({ action: "save-mood", id: entryId, mood: 3, note: "Finalement nuageux" }, alice);
      assert.deepEqual([edited.response.status, edited.data.day], [200, today]);
      assert.deepEqual(
        (await journal(alice)).map((entry) => [entry.id, entry.mood, entry.note]),
        [[entryId, 3, "Finalement nuageux"]],
      );
      assert.equal((await request({ action: "delete-mood" }, alice)).response.status, 400);
      assert.equal((await request({ action: "delete-mood", id: entryId }, alice)).response.status, 200);
      assert.deepEqual(await journal(alice), []);
      assert.equal((await request({ action: "delete-mood", id: entryId }, alice)).response.status, 404);
      assert.deepEqual((await journal(bob)).map((entry) => entry.mood), [5]);

      // Unicité (client, jour) et suppression en cascade avec le compte, vérifiées en base.
      const direct = new pg.Client({ connectionString: databaseUrl.toString() });
      await direct.connect();
      try {
        const bobId = clientId("bob@example.test");
        await assert.rejects(
          direct.query("INSERT INTO mood_entries (user_id, day, mood) VALUES ($1, $2, 1)", [bobId, today]),
          /mood_entries_user_day_unique/,
        );
        await assert.rejects(
          direct.query("INSERT INTO mood_entries (user_id, day, mood) VALUES ($1, '2000-01-01', 9)", [bobId]),
          /mood_entries_mood_check/,
        );
        await direct.query("DELETE FROM users WHERE id = $1", [bobId]);
        const { rows } = await direct.query("SELECT count(*)::int AS total FROM mood_entries");
        assert.equal(rows[0].total, 0);
      } finally {
        await direct.end();
      }

      // Page confidentialité : la donnée est décrite.
      const privacy = await (
        await fetch(origin + "/confidentialite", { headers: { "Accept-Language": "fr" } })
      ).text();
      assert.ok(privacy.includes("Journal d’humeur"));
    } catch (error) {
      error.message += "\n" + logs;
      throw error;
    } finally {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      await maintenance.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await maintenance.end();
    }
  },
);
