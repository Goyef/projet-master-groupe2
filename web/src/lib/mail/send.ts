import "server-only";

// Envoi d'e-mails par l'API Resend (https://resend.com/docs/api-reference/emails/send-email).
// La clé reste côté serveur : quiconque la lit pourrait envoyer au nom du domaine.
// Le domaine de MAIL_FROM doit être vérifié dans Resend (DKIM et SPF), sinon l'envoi est refusé.

const DEFAULT_URL = "https://api.resend.com/emails";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function mailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    // Paramétrable pour les tests (faux serveur Resend).
    url: process.env.RESEND_API_URL?.trim() || DEFAULT_URL,
    from: process.env.MAIL_FROM?.trim() || "noreply@abdu.fr",
    fromName: process.env.MAIL_FROM_NAME?.trim() || "Youcef · Synégo",
  };
}

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

let foreignReplyToLogged = false;

// Reply-To facultatif (MAIL_REPLY_TO), accepté seulement sur le domaine de l'expéditeur :
// un Reply-To vers un autre domaine (ex. une adresse Gmail) est le motif classique de
// l'hameçonnage et dégrade la délivrabilité. Sinon, aucun Reply-To n'est envoyé.
function replyToFor(from: string) {
  const replyTo = process.env.MAIL_REPLY_TO?.trim();
  if (!replyTo) return undefined;
  if (replyTo.includes("@") && domainOf(replyTo) === domainOf(from)) return replyTo;
  if (!foreignReplyToLogged) {
    foreignReplyToLogged = true;
    console.warn(`[mail] MAIL_REPLY_TO ignorée : son domaine diffère de celui de l'expéditeur (@${domainOf(from)}).`);
  }
  return undefined;
}

// Expéditeur au format attendu par Resend : « "Nom affiché" <adresse> ».
const sender = (name: string, address: string) => `"${name.replace(/["\\]/g, "")}" <${address}>`;

export const mailEnabled = () => mailConfig() !== null;

// Adresse masquée pour les journaux (pas de donnée personnelle complète) : « c***@exemple.fr ».
const masked = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

// Adresse qui reçoit les notifications du gérant (nouveau rendez-vous, demande de support…).
export function adminRecipient() {
  return process.env.MAIL_ADMIN_TO?.trim() || process.env.ADMIN_EMAIL?.trim() || null;
}

// Envoie un e-mail ; renvoie l'identifiant Resend, ou null si l'envoi est désactivé ou a échoué.
// Ne lève jamais : un e-mail qui ne part pas ne doit pas faire échouer l'action du visiteur.
export async function sendMail(mail: Mail): Promise<string | null> {
  const config = mailConfig();
  if (!config) {
    if (process.env.NODE_ENV !== "production")
      console.info(`[mail] désactivé (RESEND_API_KEY absente) : « ${mail.subject} » → ${masked(mail.to)}`);
    return null;
  }
  const replyTo = replyToFor(config.from);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: sender(config.fromName, config.from),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Ex. 403 « domain is not verified » : le domaine de MAIL_FROM n'est pas encore validé dans Resend.
      console.error(`[mail] envoi refusé par Resend (${response.status}) : « ${mail.subject} » → ${masked(mail.to)}`, await response.text());
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return data.id ?? "";
  } catch (error) {
    console.error(`[mail] envoi impossible : « ${mail.subject} » → ${masked(mail.to)}`, error);
    return null;
  }
}
