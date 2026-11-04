import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { siteUrl } from "@/lib/agenda";
import { mailReminder } from "@/lib/mail/notifications";
import { mailEnabled } from "@/lib/mail/send";
import { claimReminders, releaseReminder } from "@/lib/store";

// Tâche planifiée Vercel (vercel.json, une fois par jour) : rappel e-mail la veille de chaque
// rendez-vous confirmé. Vercel envoie « Authorization: Bearer <CRON_SECRET> » quand la variable
// est définie dans le projet ; sans elle, la route est désactivée.

export const maxDuration = 60;

// Offre gratuite Resend : 2 requêtes par seconde au plus.
const SEND_INTERVAL_MS = 600;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// Comparaison à temps constant (empreintes de même longueur).
function authorized(header: string | null, secret: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return json({ error: "disabled" }, 503);
  if (!authorized(request.headers.get("authorization"), secret))
    return json({ error: "unauthorized" }, 401);
  // Sans Resend, rien n'est réclamé : les rappels partiront une fois l'envoi configuré.
  if (!mailEnabled()) return json({ sent: 0, skipped: 0, failed: 0, mailDisabled: true });

  const site = siteUrl(request.nextUrl.origin);
  const now = new Date();
  const { claimed, alreadySent } = await claimReminders(now);
  let sent = 0;
  let failed = 0;
  for (const [index, row] of claimed.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    let ok = false;
    try {
      ok = (await mailReminder(row, site)) !== null;
    } catch (error) {
      console.error(`[rappels] préparation impossible (rendez-vous ${row.id}) :`, error);
    }
    if (ok) {
      sent++;
    } else {
      // L'échec est déjà journalisé par sendMail (adresse masquée) ; on libère le rappel.
      failed++;
      await releaseReminder(row.id, now).catch((error) =>
        console.error(`[rappels] libération impossible (rendez-vous ${row.id}) :`, error),
      );
    }
  }
  if (claimed.length) console.info(`[rappels] ${sent} envoyé(s), ${failed} en échec, ${alreadySent} déjà rappelé(s)`);
  return json({ sent, skipped: alreadySent, failed });
}
