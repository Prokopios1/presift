import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import { resolveSession, buildSessionKeys, SessionKey } from "./session";
import { validateSubmission, processSubmission, AssessmentSubmission } from "./submission";
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

export const startSession = functions.https.onCall(async (data, _context) => {
  const { assessmentId } = data;
  if (!assessmentId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing assessmentId");
  }

  try {
    const session = resolveSession(assessmentId, bank);
    const sessionKeys = buildSessionKeys(session, bank);
    const sessionToken = crypto.randomUUID();

    // Store session keys securely on the server
    await admin.firestore().collection("sessions").doc(session.sessionId).set({
      keys: sessionKeys,
      createdAt: FieldValue.serverTimestamp(),
      assessmentId,
      sessionToken,
      answers: [],
      integrityEvents: [],
      recruiterId: "demo_recruiter"
    });

    // Return the safe items and token to the client (never _keys)
    return { sessionId: session.sessionId, items: session.items, wleisItems: session.wleisItems, sessionToken };
  } catch (error) {
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

    const { keys, assessmentId, integrityEvents } = sessionDoc.data() as { keys: SessionKey[], assessmentId: string, integrityEvents?: any[] };

    const submission: AssessmentSubmission = {
      sessionId: validData.sessionId,
      answers: validData.icar,
      wleisAnswers: validData.wleis
    };

    const scoreResult = processSubmission(submission, keys);

    let fitBadge = "🔴 Low Fit";
    if (scoreResult.icar.percentile >= 80) fitBadge = "🟢 Strong Fit";
    else if (scoreResult.icar.percentile >= 50) fitBadge = "🟡 Conditional Fit";

    const candRef = admin.firestore().collection("candidates").doc(assessmentId);
    const candDoc = await candRef.get();

    if (candDoc.exists) {
      await candRef.set({
        scoreResult,
        fitBadge,
        status: "Completed",
        completedAt: FieldValue.serverTimestamp(),
        integrityEvents: integrityEvents || [],
      }, { merge: true });
    } else {
      await admin.firestore().collection("candidates").doc(candidateDocId(validData.sessionId)).set({
        assessmentId,
        scoreResult,
        fitBadge,
        status: "Completed",
        completedAt: FieldValue.serverTimestamp(),
        integrityEvents: integrityEvents || [],
      }, { merge: true });
    }

    // Mark session as used or delete it
    await sessionDoc.ref.delete();

    return { success: true };
  } catch (error) {
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
