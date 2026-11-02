import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  availableSlots,
  currentUser,
  db,
  hashPassword,
  reserve,
  tokenHash,
  types,
  verifyPassword,
  type AppointmentType,
  type User,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function text(data: Record<string, unknown>, key: string, max = 160) {
  const value = data[key];
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error("Champ invalide : " + key);
  return value.trim();
}
function email(data: Record<string, unknown>) {
  const value = text(data, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error("Adresse e-mail invalide.");
  return value;
}
function id(value: unknown) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("Identifiant invalide.");
  return number;
}
function appointmentType(value: unknown): AppointmentType {
  if (typeof value !== "string" || !Object.hasOwn(types, value))
    throw new Error("Type de rendez-vous invalide.");
  return value as AppointmentType;
}

export async function GET(request: NextRequest) {
  const user = currentUser(request.cookies.get("session")?.value);
  const action = request.nextUrl.searchParams.get("action");
  if (action === "slots") {
    try {
      const type = appointmentType(request.nextUrl.searchParams.get("type"));
      if (type === "suivi" && user?.role !== "client")
        return response({ error: "Connexion client requise." }, 401);
      return response({ slots: availableSlots(type) });
    } catch {
      return response({ error: "Type invalide." }, 400);
    }
  }
  if (action === "document") {
    if (!user) return response({ error: "Connexion requise." }, 401);
    const document = db()
      .prepare(
        "SELECT id,title,content FROM documents WHERE id=? AND (?='admin' OR user_id IS NULL OR user_id=?)",
      )
      .get(
        Number(request.nextUrl.searchParams.get("id")),
        user.role,
        user.id,
      ) as { title: string; content: Uint8Array } | undefined;
    if (!document) return response({ error: "Document introuvable." }, 404);
    return new NextResponse(new Uint8Array(document.content), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="document.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (!user) return response({ user: null });
  const appointments = db()
    .prepare(
      `SELECT a.id,a.name,a.email,a.type,a.completed,s.starts FROM appointments a JOIN slots s ON s.id=a.slot_id ${user.role === "admin" ? "" : "WHERE a.user_id=?"} ORDER BY s.starts DESC`,
    )
    .all(...(user.role === "admin" ? [] : [user.id]));
  const documents = db()
    .prepare(
      `SELECT id,title,user_id FROM documents ${user.role === "admin" ? "" : "WHERE user_id IS NULL OR user_id=?"}`,
    )
    .all(...(user.role === "admin" ? [] : [user.id]));
  return response({
    user,
    appointments,
    documents,
    ...(user.role === "admin"
      ? {
          clients: db()
            .prepare(
              "SELECT id,name,email,active FROM users WHERE role='client'",
            )
            .all(),
          slots: db()
            .prepare(
              "SELECT s.*,a.id AS appointment_id FROM slots s LEFT JOIN appointments a ON a.slot_id=s.id WHERE s.starts>? ORDER BY s.starts",
            )
            .all(Date.now()),
        }
      : {}),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next peut normaliser nextUrl sur localhost : comparer à l’hôte reçu.
  let sameOrigin = false;
  try {
    const parsed = new URL(origin || "");
    sameOrigin =
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.host === request.headers.get("host");
  } catch {}
  if (!sameOrigin)
    return response({ error: "Origine de la requête refusée." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 8_000_000)
    return response({ error: "Requête trop volumineuse." }, 413);
  const user = currentUser(request.cookies.get("session")?.value);
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (user?.role !== "admin")
        return response({ error: "Accès gérant requis." }, 403);
      const form = await request.formData();
      const file = form.get("file");
      const title = String(form.get("title") || "").trim();
      if (
        !(file instanceof File) ||
        file.size > 5_000_000 ||
        !title ||
        title.length > 160
      )
        throw new Error("Choisissez un PDF de moins de 5 Mo et un titre.");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("Seuls les fichiers PDF sont acceptés.");
      const recipient = form.get("user_id") ? id(form.get("user_id")) : null;
      if (
        recipient &&
        !db()
          .prepare("SELECT id FROM users WHERE id=? AND role='client'")
          .get(recipient)
      )
        throw new Error("Client introuvable.");
      db()
        .prepare("INSERT INTO documents(title,content,user_id) VALUES(?,?,?)")
        .run(title, bytes, recipient);
      return response({ ok: true });
    }
    const data = (await request.json()) as Record<string, unknown>;
    if (data.action === "login") {
      const address = email(data);
      const password = text(data, "password", 256);
      const now = Date.now();
      const attempts = db()
        .prepare("SELECT count,expires FROM login_attempts WHERE email=?")
        .get(address) as { count: number; expires: number } | undefined;
      if (attempts && attempts.expires > now && attempts.count >= 8)
        return response(
          { error: "Trop de tentatives. Réessayez dans 15 minutes." },
          429,
        );
      const account = db()
        .prepare("SELECT * FROM users WHERE email=? AND active=1")
        .get(address) as (User & { password: string }) | undefined;
      if (!account || !verifyPassword(password, account.password)) {
        db()
          .prepare(
            "INSERT INTO login_attempts(email,count,expires) VALUES(?,1,?) ON CONFLICT(email) DO UPDATE SET count=CASE WHEN expires>? THEN count+1 ELSE 1 END,expires=?",
          )
          .run(address, now + 900000, now, now + 900000);
        return response({ error: "Identifiants incorrects." }, 401);
      }
      db().prepare("DELETE FROM login_attempts WHERE email=?").run(address);
      const token = randomBytes(32).toString("hex");
      db()
        .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
        .run(tokenHash(token), account.id, now + 28800000);
      const result = response({ ok: true });
      result.cookies.set("session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 28800,
      });
      return result;
    }
    if (data.action === "logout") {
      const token = request.cookies.get("session")?.value;
      if (token)
        db()
          .prepare("DELETE FROM sessions WHERE token=?")
          .run(tokenHash(token));
      const result = response({ ok: true });
      result.cookies.delete("session");
      return result;
    }
    if (data.action === "reserve") {
      const type = appointmentType(data.type);
      const slot = id(data.slot);
      const name = user ? user.name : text(data, "name");
      const address = user ? user.email : email(data);
      if (data.acknowledged !== true)
        throw new Error(
          "Veuillez prendre connaissance des informations de confidentialité.",
        );
      const reference = reserve(type, slot, name, address, user);
      return response({ ok: true, reference });
    }
    if (user?.role !== "admin")
      return response({ error: "Accès gérant requis." }, 403);
    if (data.action === "create-client") {
      const password = text(data, "password", 256);
      if (password.length < 12)
        throw new Error(
          "Le mot de passe doit contenir au moins 12 caractères.",
        );
      db()
        .prepare(
          "INSERT INTO users(name,email,password,role) VALUES(?,?,?,'client')",
        )
        .run(text(data, "name"), email(data), hashPassword(password));
    } else if (data.action === "toggle-client") {
      const client = id(data.id);
      db()
        .prepare(
          "UPDATE users SET active=1-active WHERE id=? AND role='client'",
        )
        .run(client);
      db().prepare("DELETE FROM sessions WHERE user_id=?").run(client);
    } else if (data.action === "add-slot") {
      const starts = Number(data.starts);
      const ends = Number(data.ends);
      if (
        !Number.isSafeInteger(starts) ||
        !Number.isSafeInteger(ends) ||
        starts <= Date.now() ||
        ends - starts < 45 * 60000 ||
        ends - starts > 8 * 3600000
      )
        throw new Error(
          "Disponibilité invalide : durée entre 45 minutes et 8 heures, dans le futur.",
        );
      db().exec("BEGIN IMMEDIATE");
      try {
        if (
          db()
            .prepare("SELECT id FROM slots WHERE starts<? AND ends>?")
            .get(ends, starts)
        )
          throw new Error("Cette disponibilité chevauche un autre créneau.");
        db()
          .prepare("INSERT INTO slots(starts,ends) VALUES(?,?)")
          .run(starts, ends);
        db().exec("COMMIT");
      } catch (error) {
        db().exec("ROLLBACK");
        throw error;
      }
    } else if (data.action === "remove-slot") {
      const result = db()
        .prepare(
          "DELETE FROM slots WHERE id=? AND NOT EXISTS(SELECT 1 FROM appointments WHERE slot_id=slots.id)",
        )
        .run(id(data.id));
      if (!result.changes)
        throw new Error(
          "Impossible de supprimer un créneau réservé ou absent.",
        );
    } else if (data.action === "complete") {
      const result = db()
        .prepare(
          "UPDATE appointments SET completed=1-completed WHERE id=? AND slot_id IN (SELECT id FROM slots WHERE starts<?)",
        )
        .run(id(data.id), Date.now());
      if (!result.changes)
        throw new Error(
          "La séance ne peut pas être marquée réalisée avant son début.",
        );
    } else if (data.action === "remove-document") {
      db().prepare("DELETE FROM documents WHERE id=?").run(id(data.id));
    } else {
      throw new Error("Action inconnue.");
    }
    return response({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE/.test(message))
      return response(
        {
          error: "Cet élément existe déjà ou ce créneau vient d’être réservé.",
        },
        409,
      );
    if (/SQLITE|constraint|database|ENOENT|JSON|Unexpected/.test(message))
      return response(
        { error: "Impossible de traiter cette demande. Vérifiez les champs." },
        400,
      );
    return response({ error: message || "Demande invalide." }, 400);
  }
}
