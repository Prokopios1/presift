"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyToAddress = exports.senderAddress = exports.dailyCap = void 0;
exports.buildTransport = buildTransport;
exports.sentToday = sentToday;
exports.sendMail = sendMail;
exports.buildBenchmarkInvite = buildBenchmarkInvite;
exports.buildInvite = buildInvite;
exports.sendCandidateInvite = sendCandidateInvite;
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
/** Optional hard cap for the pilot channel. 0 or unset = no cap. */
const dailyCap = () => {
    const n = Number(process.env.PILOT_DAILY_CAP || "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
};
exports.dailyCap = dailyCap;
const senderAddress = () => {
    const from = process.env.SMTP_FROM;
    if (!from)
        throw new Error("SMTP_FROM is not configured");
    return from;
};
exports.senderAddress = senderAddress;
const replyToAddress = () => process.env.SMTP_REPLY_TO || undefined;
exports.replyToAddress = replyToAddress;
function buildTransport() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
        throw new Error("SMTP not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS (Secret Manager in production)");
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
async function sentToday() {
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
async function logEmail(args, result) {
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
    }
    catch (err) {
        // Logging must never break the send path.
        console.error("emailLog write failed", err);
    }
}
/**
 * Send one e-mail and record the attempt. Never throws: the caller decides
 * whether a failed mail aborts its own operation.
 */
async function sendMail(args) {
    let result;
    try {
        if ((0, exports.dailyCap)() > 0) {
            const used = await sentToday();
            if (used >= (0, exports.dailyCap)()) {
                result = { status: "skipped", reason: "daily-cap" };
                await logEmail(args, result);
                return result;
            }
        }
        const transport = buildTransport();
        const info = await transport.sendMail({
            from: (0, exports.senderAddress)(),
            to: args.to,
            replyTo: (0, exports.replyToAddress)(),
            subject: args.subject,
            text: args.text,
            html: args.html,
        });
        result = { status: "sent", messageId: info.messageId };
    }
    catch (err) {
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
        subject: (role) => `Πρόσκληση για αξιολόγηση — ${role}`,
        greeting: (name) => (name ? `Αγαπητέ/ή ${name},` : "Αγαπητέ/ή υποψήφιε,"),
        intro: (company, role) => `Η ${company} σας προσκαλεί να ολοκληρώσετε μια σύντομη διαδικτυακή αξιολόγηση για τη θέση «${role}».`,
        duration: "Η διαδικασία διαρκεί περίπου 25 λεπτά. Ο σύνδεσμος είναι προσωπικός — μην τον κοινοποιήσετε.",
        button: "Έναρξη αξιολόγησης",
        fallback: "Αν το κουμπί δεν λειτουργεί, αντιγράψτε αυτόν τον σύνδεσμο στον περιηγητή σας:",
        closing: "Με εκτίμηση,",
        signature: "Η ομάδα της PreSift",
        footer: "Λάβατε αυτό το μήνυμα επειδή υποβάλατε αίτηση ή σας πρότεινε ανάδοχος εταιρεία. Για διαγραφή των δεδομένων σας, απαντήστε σε αυτό το μήνυμα.",
    },
    en: {
        subject: (role) => `Assessment invitation — ${role}`,
        greeting: (name) => (name ? `Dear ${name},` : "Dear candidate,"),
        intro: (company, role) => `${company} invites you to complete a short online assessment for the role "${role}".`,
        duration: "It takes about 25 minutes. The link is personal — please do not share it.",
        button: "Start the assessment",
        fallback: "If the button does not work, copy this link into your browser:",
        closing: "Kind regards,",
        signature: "The PreSift team",
        footer: "You received this message because you applied or a hiring company invited you. To have your data deleted, reply to this message.",
    },
};
const TB = {
    el: {
        subject: (role) => `Πρόσκληση συμμετοχής σε εσωτερική έρευνα αναφοράς — ${role}`,
        greeting: (name) => (name ? `Αγαπητέ/ή ${name},` : "Αγαπητέ/ή συνάδελφε,"),
        intro: (company, role) => `Η ${company} σας προσκαλεί να συμμετάσχετε σε μια σύντομη εσωτερική μελέτη αναφοράς (benchmark study) για τον ρόλο «${role}».`,
        disclaimer: "Πρόκειται για εσωτερική έρευνα αναφοράς και όχι για αίτηση εργασίας. Το αποτέλεσμα δεν χρησιμοποιείται για την αξιολόγηση ή την κρίση σας.",
        duration: "Η διαδικασία διαρκεί περίπου 25 λεπτά. Ο σύνδεσμος είναι προσωπικός — μην τον κοινοποιήσετε.",
        button: "Έναρξη ερωτηματολογίου",
        fallback: "Αν το κουμπί δεν λειτουργεί, αντιγράψτε αυτόν τον σύνδεσμο στον περιηγητή σας:",
        closing: "Με εκτίμηση,",
        signature: (company) => company,
        footer: "Λάβατε αυτό το μήνυμα επειδή σας προσκάλεσε η εταιρεία σας να συμμετάσχετε σε εσωτερική έρευνα αναφοράς. Για διαγραφή των δεδομένων σας, απαντήστε σε αυτό το μήνυμα.",
    },
    en: {
        subject: (role) => `Internal benchmark study invitation — ${role}`,
        greeting: (name) => (name ? `Dear ${name},` : "Dear colleague,"),
        intro: (company, role) => `${company} invites you to take part in a short internal benchmark study for the role "${role}".`,
        disclaimer: "This is an internal benchmark study, not a job application. Your result is not used to evaluate or judge you.",
        duration: "It takes about 25 minutes. The link is personal — please do not share it.",
        button: "Start the questionnaire",
        fallback: "If the button does not work, copy this link into your browser:",
        closing: "Kind regards,",
        signature: (company) => company,
        footer: "You received this message because your company invited you to take part in an internal benchmark study. To have your data deleted, reply to this message.",
    },
};
function buildBenchmarkInvite(args) {
    const lang = args.lang === "en" ? "en" : "el";
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
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
function buildInvite(args) {
    const lang = args.lang === "en" ? "en" : "el";
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
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
async function sendCandidateInvite(args) {
    const purpose = args.purpose === "benchmark" ? "benchmark" : "hire";
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
//# sourceMappingURL=mailer.js.map