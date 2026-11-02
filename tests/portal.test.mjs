import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { randomBytes } from "node:crypto";

test(
  "réservation, comptes et isolation des documents",
  { timeout: 60000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "seminaires-test-"));
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
          DATA_DIRECTORY: directory,
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
      assert.equal((await fetch(origin)).status, 200, logs);
      for (const page of [
        "/seminaires",
        "/espace-client",
        "/mentions-legales",
        "/confidentialite",
      ])
        assert.equal((await fetch(origin + page)).status, 200);
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
      for (const name of ["Alice", "Bob"])
        assert.equal(
          (
            await request(
              {
                action: "create-client",
                name,
                email: name.toLowerCase() + "@example.test",
                password,
              },
              admin,
            )
          ).response.status,
          200,
        );
      const alice = await login("alice@example.test"),
        bob = await login("bob@example.test");
      const starts = Date.now() + 86400000,
        ends = starts + 3600000;
      assert.equal(
        (await request({ action: "add-slot", starts, ends }, admin)).response
          .status,
        200,
      );
      assert.equal(
        (
          await request(
            { action: "add-slot", starts: starts + 10000, ends: ends + 10000 },
            admin,
          )
        ).response.status,
        400,
      );
      const available = await request("?action=slots&type=audit", "", "GET");
      const slot = available.data.slots[0].id;
      const competing = await Promise.all(
        [alice, bob].map((cookie) =>
          request(
            { action: "reserve", type: "audit", slot, acknowledged: true },
            cookie,
          ),
        ),
      );
      assert.deepEqual(
        competing.map((value) => value.response.status).sort(),
        [200, 400],
      );
      assert.equal(
        (await request("?action=slots&type=audit", "", "GET")).data.slots
          .length,
        0,
      );
      const a = (await request("", alice, "GET")).data,
        b = (await request("", bob, "GET")).data;
      assert.equal(a.appointments.length + b.appointments.length, 1);
      assert.equal(
        (await request({ action: "remove-slot", id: slot }, admin)).response
          .status,
        400,
      );
      assert.equal(
        (
          await request({
            action: "reserve",
            type: "suivi",
            slot,
            name: "Test",
            email: "test@example.test",
            acknowledged: true,
          })
        ).response.status,
        400,
      );
      const clients = (await request("", admin, "GET")).data.clients;
      const aliceId = clients.find((client) => client.name === "Alice").id;
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
      assert.equal(
        (await request({ action: "logout" }, bob)).response.status,
        200,
      );
      assert.equal((await request("", bob, "GET")).data.user, null);
    } finally {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
      // Vérifier la cible absolue avant de supprimer le répertoire de test.
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith("seminaires-test-"));
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
