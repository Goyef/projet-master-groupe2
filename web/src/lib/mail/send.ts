import "server-only";

// Envoi d'e-mails par l'API transactionnelle puwapi (module « Send »).
// La clé reste côté serveur : quiconque la lit pourrait envoyer au nom du domaine.
// L'envoi est asynchrone chez puwapi (file d'attente, 30 messages par minute pour
// l'organisation) : un message accepté (201) n'est pas encore un message remis.

const DEFAULT_URL = "https://send.puwapi.com/api/public/send/messages";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

function mailConfig() {
  const apiKey = process.env.PUWAPI_SEND_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    url: process.env.PUWAPI_SEND_URL?.trim() || DEFAULT_URL,
    from: process.env.MAIL_FROM?.trim() || "noreply@abdu.fr",
    fromName: process.env.MAIL_FROM_NAME?.trim() || "Youcef · Synégo",
    // Les réponses des clients arrivent chez Youcef, pas sur l'adresse noreply.
    replyTo: process.env.MAIL_REPLY_TO?.trim() || process.env.ADMIN_EMAIL?.trim() || undefined,
  };
}

export const mailEnabled = () => mailConfig() !== null;

// Adresse masquée pour les journaux (pas de donnée personnelle complète) : « c***@exemple.fr ».
const masked = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

// Adresse qui reçoit les notifications du gérant (nouveau rendez-vous, demande de support…).
export function adminRecipient() {
  return process.env.MAIL_ADMIN_TO?.trim() || process.env.ADMIN_EMAIL?.trim() || null;
}

// Envoie un e-mail ; renvoie l'identifiant puwapi, ou null si l'envoi est désactivé ou a échoué.
// Ne lève jamais : un e-mail qui ne part pas ne doit pas faire échouer l'action du visiteur.
export async function sendMail(mail: Mail): Promise<string | null> {
  const config = mailConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production")
      console.info(`[mail] désactivé (PUWAPI_SEND_API_KEY absente) : « ${mail.subject} » → ${masked(mail.to)}`);
    return null;
  }
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "X-Server-API-Key": config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [mail.to],
        from: config.from,
        fromName: config.fromName,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo || config.replyTo ? { replyTo: mail.replyTo || config.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[mail] envoi refusé (${response.status}) : « ${mail.subject} » → ${masked(mail.to)}`, await response.text());
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string | number; message?: { id?: string | number } };
    return String(data.id ?? data.message?.id ?? "");
  } catch (error) {
    console.error(`[mail] envoi impossible : « ${mail.subject} » → ${masked(mail.to)}`, error);
    return null;
  }
}
