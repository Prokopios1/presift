import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { resolveSession, buildSessionKeys, SessionKey } from "./session";
import { validateSubmission, processSubmission, AssessmentSubmission } from "./submission";
import { scoreSmileTask, SmileTrialConfig } from "./smile";
import { bank } from "./data/presift-bank";
import * as nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.sendgrid.net",
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER || "apikey",
    pass: process.env.SMTP_PASS || "SG.production_key_mock"
  },
});

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Demo bypass: allow anonymous callers when enabled via functions config
// (set with: firebase functions:config:set demo.allow_anon=true) or when
// running under the local emulator.
function demoConfig(): { allow_anon?: string; origin?: string } {
  try {
    return (functions.config().demo as { allow_anon?: string; origin?: string }) || {};
  } catch {
    return {};
  }
}
const allowAnonDemo = (): boolean =>
  process.env.FUNCTIONS_EMULATOR === "true" || demoConfig().allow_anon === "true";

export * from "./seeder";
export * from "./stripe";

export const generateB2BInvoice = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }
  const { transactionId, companyName, amount, email } = data;
  if (!transactionId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing transactionId");
  }

  const doc = new PDFDocument();
  const buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  return new Promise((resolve, reject) => {
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      const base64Pdf = pdfData.toString('base64');
      resolve({ receiptUrl: `data:application/pdf;base64,${base64Pdf}` });
    });
    doc.on('error', reject);

    doc.fontSize(25).text('PreSift B2B Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Transaction ID: ${transactionId}`);
    if (companyName) doc.text(`Company: ${companyName}`);
    if (email) doc.text(`Email: ${email}`);
    if (amount) doc.text(`Amount: $${amount}`);
    doc.moveDown();
    doc.text('Thank you for your business!');

    doc.end();
  });
});

import * as crypto from "crypto";

export const topUpCredits = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { amount } = data;
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Valid amount required");
  }
  const uid = _context.auth?.uid || "demo_recruiter";
  const recruiterRef = admin.firestore().collection("users").doc(uid);
  await recruiterRef.set({
    credits: FieldValue.increment(amount)
  }, { merge: true });
  return { success: true };
});

export const createAssessmentLink = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { roleTitle, candidateName, candidateEmail } = data;
  if (!roleTitle) throw new functions.https.HttpsError("invalid-argument", "Missing roleTitle");

  const recruiterId = _context.auth?.uid || "demo_recruiter";
  const recruiterRef = admin.firestore().collection("users").doc(recruiterId);
  const doc = await recruiterRef.get();
  const credits = doc.data()?.credits || 0;
  if (credits <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient credits");
  }

  // Deduct 1 credit immediately
  await recruiterRef.update({
    credits: FieldValue.increment(-1)
  });

  const candRef = admin.firestore().collection("candidates").doc();
  await candRef.set({
    appliedRole: roleTitle,
    name: candidateName || "",
    email: candidateEmail || "",
    status: "Invited",
    createdAt: FieldValue.serverTimestamp(),
    recruiterId,
  });

  // Return the URL for the recruiter to copy (config-driven origin; set with
  // firebase functions:config:set demo.origin=https://presift.web.app)
  const origin = demoConfig().origin || "http://localhost:5173";
  return { url: `${origin}/assessment/${candRef.id}`, candidateId: candRef.id };
});

// Candidate mutations go through callables (admin SDK) so Firestore rules can
// lock candidates against direct client writes/deletes. The auth gate matches
// the rest of the app: anonymous callers are accepted only in demo mode
// (emulator or demo.allow_anon=true config).
export const deleteCandidate = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { candidateId } = data || {};
  if (!candidateId || typeof candidateId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
  }
  const candRef = admin.firestore().collection("candidates").doc(candidateId);
  const doc = await candRef.get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Candidate not found");
  }
  await candRef.delete();
  return { success: true };
});

const ALLOWED_CANDIDATE_STATUSES = new Set([
  "Invited", "In Progress", "Shortlisted", "Interviewing", "Rejected", "Completed", "Abandoned",
]);

export const updateCandidateStatus = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { candidateId, status } = data || {};
  if (!candidateId || typeof candidateId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
  }
  if (!status || typeof status !== "string" || !ALLOWED_CANDIDATE_STATUSES.has(status)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid status. Allowed: ${[...ALLOWED_CANDIDATE_STATUSES].join(", ")}`);
  }
  const candRef = admin.firestore().collection("candidates").doc(candidateId);
  const doc = await candRef.get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Candidate not found");
  }
  await candRef.update({ status });
  return { success: true };
});

export const updateCandidate = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { candidateId, name, email, appliedRole } = data || {};

  if (!candidateId || typeof candidateId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
  }

  const updates: Record<string, string> = {};

  if (name !== undefined) {
    if (typeof name !== "string") throw new functions.https.HttpsError("invalid-argument", "Invalid name");
    const trimmed = name.trim();
    if (!trimmed) throw new functions.https.HttpsError("invalid-argument", "Name cannot be empty");
    updates.name = trimmed;
  }

  if (email !== undefined) {
    if (typeof email !== "string") throw new functions.https.HttpsError("invalid-argument", "Invalid email");
    const trimmed = email.trim();
    if (!trimmed) throw new functions.https.HttpsError("invalid-argument", "Email cannot be empty");
    updates.email = trimmed;
  }

  if (appliedRole !== undefined) {
    if (typeof appliedRole !== "string") throw new functions.https.HttpsError("invalid-argument", "Invalid appliedRole");
    const trimmed = appliedRole.trim();
    if (!trimmed) throw new functions.https.HttpsError("invalid-argument", "Applied role cannot be empty");
    updates.appliedRole = trimmed;
  }

  const candRef = admin.firestore().collection("candidates").doc(candidateId);
  const doc = await candRef.get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Candidate not found");
  }

  if (Object.keys(updates).length > 0) {
    await candRef.update(updates);
  }

  return { success: true };
});

export const bulkDeleteCandidates = functions.https.onCall(async (data, _context) => {
  if (!_context.auth && !allowAnonDemo()) throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  const { candidateIds } = data || {};

  if (!Array.isArray(candidateIds) || candidateIds.length === 0 || candidateIds.length > 100) {
    throw new functions.https.HttpsError("invalid-argument", "candidateIds must be an array of length 1-100");
  }

  for (const id of candidateIds) {
    if (typeof id !== "string" || !id.trim()) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid candidate ID in array");
    }
  }

  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new functions.https.HttpsError("invalid-argument", "Duplicate candidate IDs not allowed");
  }

  const db = admin.firestore();

  const refs = candidateIds.map(id => db.collection("candidates").doc(id));
  const docs = await db.getAll(...refs);

  const existingIds: string[] = [];
  const missingIds: string[] = [];

  docs.forEach((doc, i) => {
    if (doc.exists) {
      existingIds.push(candidateIds[i]);
    } else {
      missingIds.push(candidateIds[i]);
    }
  });

  if (existingIds.length > 0) {
    const batch = db.batch();
    for (const id of existingIds) {
      batch.delete(db.collection("candidates").doc(id));
    }
    await batch.commit();
  }

  return { deleted: existingIds.length, missing: missingIds };
});

export const startSession = functions.https.onCall(async (data, _context) => {
  const { assessmentId } = data;
  if (!assessmentId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing assessmentId");
  }

  try {
    const session = resolveSession(assessmentId, bank);
    const sessionKeys = buildSessionKeys(session, bank);
    const sessionToken = crypto.randomUUID();

    // Capture the candidate's identity from the candidate record (if it exists
    // in THIS database). submitAssessment later uses this as the fallback
    // identity for the result doc, so a completed result is never written as an
    // anonymous invisible orphan — even if the candidate doc is deleted between
    // session start and submission (e.g. by the demo seeder).
    let identity: { candidateName: string; candidateEmail: string; appliedRole: string; candidateRecruiterId: string } = {
      candidateName: "",
      candidateEmail: "",
      appliedRole: "",
      candidateRecruiterId: "",
    };
    try {
      const candDoc = await admin.firestore().collection("candidates").doc(assessmentId).get();
      if (candDoc.exists) {
        const c = candDoc.data() as { name?: string; email?: string; appliedRole?: string; recruiterId?: string };
        identity = {
          candidateName: c.name || "",
          candidateEmail: c.email || "",
          appliedRole: c.appliedRole || "",
          candidateRecruiterId: c.recruiterId || "",
        };
      }
    } catch (err) {
      // Best-effort capture: if the candidate read fails (e.g. the link was
      // created against a different database/emulator), the session still
      // starts; submitAssessment will then fail loudly instead of producing an
      // invisible orphan result.
      console.error("startSession: could not read candidate identity for", assessmentId, err);
    }

    // Store session keys securely on the server
    await admin.firestore().collection("sessions").doc(session.sessionId).set({
      keys: sessionKeys,
      createdAt: FieldValue.serverTimestamp(),
      assessmentId,
      sessionToken,
      answers: [],
      integrityEvents: [],
      recruiterId: "demo_recruiter",
      ...identity,
    });

    // Return the safe items and token to the client (never _keys)
    return { sessionId: session.sessionId, items: session.items, wleisItems: session.wleisItems, sessionToken, smileTask: session.smileTask };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("Session generation error:", error);
    throw new functions.https.HttpsError("internal", "Failed to start session.");
  }
});

import { candidateDocId } from "./submission";

export const submitAssessment = functions.https.onCall(async (data, _context) => {
  try {
    const validData = validateSubmission(data, bank);

    const sessionDoc = await admin.firestore().collection("sessions").doc(validData.sessionId).get();
    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError("not-found", "This test session has expired or already been submitted.");
    }

    const { keys, assessmentId, integrityEvents, candidateName, candidateEmail, appliedRole, candidateRecruiterId } = sessionDoc.data() as {
      keys: SessionKey[];
      assessmentId: string;
      integrityEvents?: any[];
      candidateName?: string;
      candidateEmail?: string;
      appliedRole?: string;
      candidateRecruiterId?: string;
    };

    const submission: AssessmentSubmission = {
      sessionId: validData.sessionId,
      answers: validData.icar,
      wleisAnswers: validData.wleis,
      smileAnswers: validData.smileAnswers,
    };

    const scoreResult = processSubmission(submission, keys);

    let smileScoringResult = null;
    if (validData.smileAnswers && bank.smileTask?.trials) {
      // WLEIS OEA is a sum of 4 items (each 1-7), so mean is 1-7.
      const rawOea1to7 = scoreResult.wleis?.rawScores?.OEA !== undefined ? (scoreResult.wleis.rawScores.OEA / 4) : 4.0;
      // Convert the 1-7 OEA mean to the 1-5 calibration scale.
      // scoreResult.smile.calibration.rawOea will now reflect this 1-5 scale.
      const rawOea = 1 + ((rawOea1to7 - 1) / 6) * 4;
      const smileTrials: SmileTrialConfig[] = bank.smileTask.trials.map((t: any) => ({
        trialId: t.trialId,
        start: t.start,
        end: t.end,
        groundTruth: (t.groundTruth === 'fake' ? 'fake' : 'genuine') as 'genuine' | 'fake',
      }));
      smileScoringResult = scoreSmileTask(validData.smileAnswers, smileTrials, rawOea);
    }

    let fitBadge = "🔴 Low Fit";
    if (scoreResult.icar.percentile >= 80) fitBadge = "🟢 Strong Fit";
    else if (scoreResult.icar.percentile >= 50) fitBadge = "🟡 Conditional Fit";

    const resultPayload = {
      scoreResult: {
        ...scoreResult,
        ...(smileScoringResult ? { smile: smileScoringResult } : {}),
      },
      ...(smileScoringResult ? { smileResult: smileScoringResult } : {}),
      fitBadge,
      status: "Completed",
      completedAt: FieldValue.serverTimestamp(),
      completionDate: new Date().toISOString(),
      integrityEvents: integrityEvents || [],
    };

    const candRef = admin.firestore().collection("candidates").doc(assessmentId);
    const candDoc = await candRef.get();

    if (candDoc.exists) {
      await candRef.set(resultPayload, { merge: true });
    } else {
      // No candidate record in this database. If startSession captured the
      // candidate's identity (the candidate doc existed at session start), we
      // reconstruct a NAMED result doc so the dashboard query can always find
      // it. Without a recruiterId the result would be invisible — fail loudly
      // instead of writing an anonymous orphan.
      if (!candidateRecruiterId) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "This assessment link is invalid — no candidate record was found for it. Please contact the recruiter to receive a new link."
        );
      }
      await admin.firestore().collection("candidates").doc(candidateDocId(validData.sessionId)).set({
        assessmentId,
        name: candidateName || "",
        email: candidateEmail || "",
        appliedRole: appliedRole || "",
        recruiterId: candidateRecruiterId,
        ...resultPayload,
      }, { merge: true });
    }

    // Mark session as used or delete it
    await sessionDoc.ref.delete();

    return { success: true, scoreResult: resultPayload.scoreResult };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("Submission error:", error);
    throw new functions.https.HttpsError("invalid-argument", "Failed to evaluate candidate.");
  }
});

export const checkAbandonedSessions = functions.pubsub.schedule("every 24 hours").onRun(async (_context) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const snapshot = await admin.firestore().collection("candidates")
    .where("status", "==", "In Progress")
    .where("createdAt", "<", cutoff)
    .get();

  const batch = admin.firestore().batch();

  for (const docSnapshot of snapshot.docs) {
    const candidateData = docSnapshot.data();
    batch.update(docSnapshot.ref, { status: "Abandoned" });

    let answersLength = 0;
    const sessionId = docSnapshot.id.startsWith("cand_") ? docSnapshot.id.substring(5) : null;
    if (sessionId) {
      const sessionDoc = await admin.firestore().collection("sessions").doc(sessionId).get();
      if (sessionDoc.exists) {
        const sessionData = sessionDoc.data();
        answersLength = sessionData?.answers?.length || 0;
      }
    }

    if (answersLength < 3 && candidateData.recruiterId) {
      const recruiterRef = admin.firestore().collection("users").doc(candidateData.recruiterId);
      batch.update(recruiterRef, {
        credits: FieldValue.increment(1)
      });
    }

    if (candidateData.email) {
      try {
        await transporter.sendMail({
          from: '"PreSift Support" <support@presift.app>',
          to: candidateData.email,
          subject: "Your assessment is still pending",
          text: "Please complete your assessment within 24 hours.",
        });
      } catch (err) {
        console.error("Email failed for", candidateData.email, err);
      }
    }
  }

  await batch.commit();
  console.log(`Abandoned ${snapshot.size} sessions.`);
});

export const integrity = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  try {
    const { sessionId, type, at } = req.body;
    if (!sessionId || !type || !at) {
      res.status(400).send('Bad Request');
      return;
    }
    const sessionRef = admin.firestore().collection("sessions").doc(sessionId);
    await admin.firestore().runTransaction(async (t) => {
      const doc = await t.get(sessionRef);
      if (doc.exists) {
        const data = doc.data();
        let events = data?.integrityEvents || [];
        events.push({ type, at });
        if (events.length > 20) {
          events = events.slice(events.length - 20);
        }
        t.update(sessionRef, { integrityEvents: events });
      }
    });
    res.status(200).send({ success: true });
  } catch (error) {
    console.error("Integrity log error:", error);
    res.status(500).send('Internal Server Error');
  }
});
