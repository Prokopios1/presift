import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

/**
 * Outbound candidate e-mail.
 *
 * Pilot channel: Gmail SMTP with a Google app password.
 * Production channel (later): presift@oooops.eu — same transport, different credentials.
 * Secrets come from the environment (Secret Manager on deploy). There is no fallback
 * credential on purpose: a missing key must fail loudly, never silently.
 */

export type MailKind = "invite" | "reminder" | "result" | "other";
export type MailLang = "el" | "en";
export type InvitePurpose = "hire" | "benchmark";

export interface SendMailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
  kind: MailKind;
  lang?: MailLang;
  purpose?: InvitePurpose;
  candidateId?: string;
  recruiterId?: string;
}

export interface SendMailResult {
  status: "sent" | "failed" | "skipped";
  reason?: string;
  messageId?: string;
  error?: string;
}

/** Optional hard cap for the pilot channel. 0 or unset = no cap. */
export const dailyCap = (): number => {
  const n = Number(process.env.PILOT_DAILY_CAP || "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const senderAddress = (): string => {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_FROM is not configured");
  return from;
};

export const replyToAddress = (): string | undefined =>
  process.env.SMTP_REPLY_TO || undefined;

export function buildTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS (Secret Manager in production)"
    );
  }
  const port = Number(process.env.SMTP_PORT || "465");
  const secure = process.env.SMTP_SECURE !== "false" && port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/** Count today's sent invites. Used by the pilot cap. */
export async function sentToday(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const snap = await admin
    .firestore()
    .collection("emailLog")
    .where("status", "==", "sent")
    .where("createdAt", ">=", start)
    .count()
    .get();
  return snap.data().count;
}

async function logEmail(args: SendMailArgs, result: SendMailResult) {
  try {
    await admin
      .firestore()
      .collection("emailLog")
      .add({
        to: args.to,
        kind: args.kind,
        purpose: args.purpose || "hire",
        lang: args.lang || null,
        subject: args.subject,
        status: result.status,
        reason: result.reason || null,
        error: result.error || null,
        messageId: result.messageId || null,
        candidateId: args.candidateId || null,
        recruiterId: args.recruiterId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    // Logging must never break the send path.
    console.error("emailLog write failed", err);
  }
}

/**
 * Send one e-mail and record the attempt. Never throws: the caller decides
 * whether a failed mail aborts its own operation.
 */
export async function sendMail(args: SendMailArgs): Promise<SendMailResult> {
  let result: SendMailResult;

  try {
    if (dailyCap() > 0) {
      const used = await sentToday();
      if (used >= dailyCap()) {
        result = { status: "skipped", reason: "daily-cap" };
        await logEmail(args, result);
        return result;
      }
    }

    const transport = buildTransport();
    const info = await transport.sendMail({
      from: senderAddress(),
      to: args.to,
      replyTo: replyToAddress(),
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    result = { status: "sent", messageId: info.messageId };
  } catch (err: any) {
    console.error("mail send failed for", args.to, err?.message || err);
    result = { status: "failed", error: String(err?.message || err) };
  }

  await logEmail(args, result);
  return result;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const T = {
  el: {
    subject: (role: string) => `Πρόσκληση για αξιολόγηση — ${role}`,
    greeting: (name: string) => (name ? `Αγαπητέ/ή ${name},` : "Αγαπητέ/ή υποψήφιε,"),
    intro: (company: string, role: string) =>
      `Η ${company} σας προσκαλεί να ολοκληρώσετε μια σύντομη διαδικτυακή αξιολόγηση για τη θέση «${role}».`,
    duration: "Η διαδικασία διαρκεί περίπου 25 λεπτά. Ο σύνδεσμος είναι προσωπικός — μην τον κοινοποιήσετε.",
    button: "Έναρξη αξιολόγησης",
    fallback: "Αν το κουμπί δεν λειτουργεί, αντιγράψτε αυτόν τον σύνδεσμο στον περιηγητή σας:",
    closing: "Με εκτίμηση,",
    signature: "Η ομάδα της PreSift",
    footer:
      "Λάβατε αυτό το μήνυμα επειδή υποβάλατε αίτηση ή σας πρότεινε ανάδοχος εταιρεία. Για διαγραφή των δεδομένων σας, απαντήστε σε αυτό το μήνυμα.",
  },
  en: {
    subject: (role: string) => `Assessment invitation — ${role}`,
    greeting: (name: string) => (name ? `Dear ${name},` : "Dear candidate,"),
    intro: (company: string, role: string) =>
      `${company} invites you to complete a short online assessment for the role "${role}".`,
    duration: "It takes about 25 minutes. The link is personal — please do not share it.",
    button: "Start the assessment",
    fallback: "If the button does not work, copy this link into your browser:",
    closing: "Kind regards,",
    signature: "The PreSift team",
    footer:
      "You received this message because you applied or a hiring company invited you. To have your data deleted, reply to this message.",
  },
} as const;

export interface InviteArgs {
  to: string;
  candidateName?: string;
  roleTitle: string;
  company: string;
  url: string;
  lang?: MailLang;
  purpose?: InvitePurpose;
  candidateId?: string;
  recruiterId?: string;
}

const TB = {
  el: {
    subject: (role: string) => `Πρόσκληση συμμετοχής σε εσωτερική έρευνα αναφοράς — ${role}`,
    greeting: (name: string) => (name ? `Αγαπητέ/ή ${name},` : "Αγαπητέ/ή συνάδελφε,"),
    intro: (company: string, role: string) =>
      `Η ${company} σας προσκαλεί να συμμετάσχετε σε μια σύντομη εσωτερική μελέτη αναφοράς (benchmark study) για τον ρόλο «${role}».`,
    disclaimer:
      "Πρόκειται για εσωτερική έρευνα αναφοράς και όχι για αίτηση εργασίας. Το αποτέλεσμα δεν χρησιμοποιείται για την αξιολόγηση ή την κρίση σας.",
    duration: "Η διαδικασία διαρκεί περίπου 25 λεπτά. Ο σύνδεσμος είναι προσωπικός — μην τον κοινοποιήσετε.",
    button: "Έναρξη ερωτηματολογίου",
    fallback: "Αν το κουμπί δεν λειτουργεί, αντιγράψτε αυτόν τον σύνδεσμο στον περιηγητή σας:",
    closing: "Με εκτίμηση,",
    signature: (company: string) => company,
    footer:
      "Λάβατε αυτό το μήνυμα επειδή σας προσκάλεσε η εταιρεία σας να συμμετάσχετε σε εσωτερική έρευνα αναφοράς. Για διαγραφή των δεδομένων σας, απαντήστε σε αυτό το μήνυμα.",
  },
  en: {
    subject: (role: string) => `Internal benchmark study invitation — ${role}`,
    greeting: (name: string) => (name ? `Dear ${name},` : "Dear colleague,"),
    intro: (company: string, role: string) =>
      `${company} invites you to take part in a short internal benchmark study for the role "${role}".`,
    disclaimer:
      "This is an internal benchmark study, not a job application. Your result is not used to evaluate or judge you.",
    duration: "It takes about 25 minutes. The link is personal — please do not share it.",
    button: "Start the questionnaire",
    fallback: "If the button does not work, copy this link into your browser:",
    closing: "Kind regards,",
    signature: (company: string) => company,
    footer:
      "You received this message because your company invited you to take part in an internal benchmark study. To have your data deleted, reply to this message.",
  },
} as const;

export function buildBenchmarkInvite(args: InviteArgs) {
  const lang: MailLang = args.lang === "en" ? "en" : "el";
  const t = TB[lang];
  const name = (args.candidateName || "").trim();
  const subject = t.subject(args.roleTitle);
  const text = [
    t.greeting(name),
    "",
    t.intro(args.company, args.roleTitle),
    "",
    t.disclaimer,
    "",
    t.duration,
    "",
    args.url,
    "",
    t.closing,
    t.signature(args.company),
    "",
    t.footer,
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
    <tr><td>
      <p style="margin:0 0 16px">${esc(t.greeting(name))}</p>
      <p style="margin:0 0 16px">${esc(t.intro(args.company, args.roleTitle))}</p>
      <p style="margin:0 0 16px">${esc(t.disclaimer)}</p>
      <p style="margin:0 0 24px">${esc(t.duration)}</p>
      <p style="margin:0 0 24px">
        <a href="${esc(args.url)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">${esc(t.button)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#4b5563">${esc(t.fallback)}</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${esc(args.url)}">${esc(args.url)}</a></p>
      <p style="margin:0">${esc(t.closing)}<br>${esc(t.signature(args.company))}</p>
      <p style="margin:24px 0 0;font-size:11px;color:#6b7280">${esc(t.footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html, lang };
}

export function buildInvite(args: InviteArgs) {
  const lang: MailLang = args.lang === "en" ? "en" : "el";
  const t = T[lang];
  const name = (args.candidateName || "").trim();
  const subject = t.subject(args.roleTitle);
  const text = [
    t.greeting(name),
    "",
    t.intro(args.company, args.roleTitle),
    "",
    t.duration,
    "",
    args.url,
    "",
    t.closing,
    t.signature,
    "",
    t.footer,
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="${lang}">
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
    <tr><td>
      <p style="margin:0 0 16px">${esc(t.greeting(name))}</p>
      <p style="margin:0 0 16px">${esc(t.intro(args.company, args.roleTitle))}</p>
      <p style="margin:0 0 24px">${esc(t.duration)}</p>
      <p style="margin:0 0 24px">
        <a href="${esc(args.url)}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none">${esc(t.button)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#4b5563">${esc(t.fallback)}</p>
      <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${esc(args.url)}">${esc(args.url)}</a></p>
      <p style="margin:0">${esc(t.closing)}<br>${esc(t.signature)}</p>
      <p style="margin:24px 0 0;font-size:11px;color:#6b7280">${esc(t.footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html, lang };
}

/** Send the candidate invitation for an assessment link. Never throws. */
export async function sendCandidateInvite(args: InviteArgs): Promise<SendMailResult> {
  const purpose: InvitePurpose = args.purpose === "benchmark" ? "benchmark" : "hire";
  const built = purpose === "benchmark" ? buildBenchmarkInvite(args) : buildInvite(args);
  return sendMail({
    to: args.to,
    subject: built.subject,
    text: built.text,
    html: built.html,
    kind: "invite",
    lang: built.lang,
    purpose,
    candidateId: args.candidateId,
    recruiterId: args.recruiterId,
  });
}
