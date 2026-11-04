import "server-only";

import { createHash } from "node:crypto";
import { and, like, lt, sql } from "drizzle-orm";

import { loginAttempts } from "@/db/schema";
import { db } from "@/lib/store";

// Limites d'usage de l'assistant, sur le modèle du « mot de passe oublié » et de la liste
// d'attente (table `login_attempts`, clé préfixée). Chaque message coûte un appel payant à OpenAI :
// - par connexion (adresse IP, stockée sous forme d'empreinte) : ASSISTANT_REQUESTS_MAX messages
//   par quart d'heure ;
// - pour tout le site : un plafond quotidien (ASSISTANT_DAILY_LIMIT, 500 par défaut).

export const ASSISTANT_REQUESTS_MAX = 20;
const WINDOW_MS = 15 * 60_000;
const DAY_MS = 86400_000;

// Empreinte de l'adresse IP : l'adresse elle-même n'est pas enregistrée. `x-real-ip` d'abord :
// posé par le proxy (Vercel le réécrit), il ne peut pas être fourni par le visiteur, alors que le
// premier élément de `x-forwarded-for` peut l'être derrière un proxy qui complète l'en-tête.
export function visitorKey(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = headers.get("x-real-ip")?.trim() || forwarded || "inconnue";
  return createHash("sha256").update(`synego-assistant:${address}`).digest("hex").slice(0, 32);
}

// Incrémente le compteur `key` et indique s'il reste sous `max` (une seule requête, sans course).
async function consume(key: string, max: number, windowMs: number, now: Date) {
  const database = await db();
  const expires = new Date(now.getTime() + windowMs);
  const [row] = await database
    .insert(loginAttempts)
    .values({ email: key, count: 1, expires })
    .onConflictDoUpdate({
      target: loginAttempts.email,
      set: {
        count: sql`CASE WHEN ${loginAttempts.expires} > ${now} THEN ${loginAttempts.count} + 1 ELSE 1 END`,
        expires: sql`CASE WHEN ${loginAttempts.expires} > ${now} THEN ${loginAttempts.expires} ELSE ${expires} END`,
      },
    })
    .returning({ count: loginAttempts.count });
  return (row?.count ?? 1) <= max;
}

// Repli si la base est indisponible : compteur en mémoire, propre à l'instance du serveur.
const memory = new Map<string, { count: number; expires: number }>();
function consumeInMemory(key: string, max: number, windowMs: number, now: number) {
  const entry = memory.get(key);
  if (!entry || entry.expires <= now) {
    if (memory.size > 5000) memory.clear();
    memory.set(key, { count: 1, expires: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

export type AssistantQuota = "ok" | "visitor" | "daily";

export async function consumeAssistantQuota(visitor: string, dailyLimit: number): Promise<AssistantQuota> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  try {
    if (!(await consume(`assistant:ip:${visitor}`, ASSISTANT_REQUESTS_MAX, WINDOW_MS, now))) return "visitor";
    if (!(await consume(`assistant:day:${day}`, dailyLimit, DAY_MS, now))) return "daily";
    // Ménage occasionnel des compteurs expirés de l'assistant.
    if (Math.random() < 0.02) {
      const database = await db();
      await database
        .delete(loginAttempts)
        .where(and(like(loginAttempts.email, "assistant:%"), lt(loginAttempts.expires, now)));
    }
    return "ok";
  } catch (error) {
    console.error("[assistant] compteur indisponible, repli en mémoire :", error);
    const time = now.getTime();
    if (!consumeInMemory(`ip:${visitor}`, ASSISTANT_REQUESTS_MAX, WINDOW_MS, time)) return "visitor";
    if (!consumeInMemory(`day:${day}`, dailyLimit, DAY_MS, time)) return "daily";
    return "ok";
  }
}
