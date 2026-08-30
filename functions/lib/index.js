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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClient = exports.getCandidateStatus = exports.integrity = exports.archiveCandidate = exports.archiveClient = exports.updateClient = exports.adjustClientCredits = exports.updateCandidateClients = exports.checkAbandonedSessions = exports.submitAssessment = exports.startSession = exports.bulkDeleteCandidates = exports.updateCandidate = exports.updateCandidateStatus = exports.deleteCandidate = exports.createAssessmentLink = exports.topUpCredits = exports.generateB2BInvoice = exports.createClient = exports.registerRecruiter = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
const session_1 = require("./session");
const submission_1 = require("./submission");
const smile_1 = require("./smile");
const presift_bank_1 = require("./data/presift-bank");
const nodemailer = __importStar(require("nodemailer"));
const pdfkit_1 = __importDefault(require("pdfkit"));
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
function demoConfig() {
    try {
        return functions.config().demo || {};
    }
    catch {
        return {};
    }
}
const allowAnonDemo = () => process.env.FUNCTIONS_EMULATOR === "true" || demoConfig().allow_anon === "true";
__exportStar(require("./seeder"), exports);
__exportStar(require("./stripe"), exports);
const auth_1 = require("./utils/auth");
exports.registerRecruiter = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo()) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in or running in demo mode");
    }
    const { name, email, companyName, vatId, billingAddress, uid: clientUid } = data || {};
    // Validate name
    if (!name || typeof name !== "string" || !name.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Full name is required");
    }
    const trimmedName = name.trim();
    // Validate email
    if (!email || typeof email !== "string" || !email.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Business email is required");
    }
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid email format");
    }
    // Validate companyName
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Company name is required");
    }
    const trimmedCompanyName = companyName.trim();
    // Optional fields validation
    if (vatId !== undefined && typeof vatId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Invalid vatId");
    }
    const trimmedVatId = typeof vatId === "string" ? vatId.trim() : "";
    if (billingAddress !== undefined && typeof billingAddress !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Invalid billingAddress");
    }
    const trimmedBillingAddress = typeof billingAddress === "string" ? billingAddress.trim() : "";
    // Resolve UID (caller-provided, context auth uid, or newly generated)
    let uid = "";
    if (clientUid !== undefined) {
        if (typeof clientUid !== "string" || !clientUid.trim()) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid uid");
        }
        uid = clientUid.trim();
    }
    else if (_context.auth?.uid) {
        uid = _context.auth.uid;
    }
    else {
        uid = crypto.randomUUID();
    }
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    // Adoption logic: look for existing admin-created doc by email
    const existingUsersQuery = await db.collection("users")
        .where("email", "==", trimmedEmail)
        .get();
    let adoptionCandidate = null;
    for (const doc of existingUsersQuery.docs) {
        if (doc.id === uid)
            continue;
        const data = doc.data();
        if (data.archived === true)
            continue;
        if (data.mergedInto)
            continue; // Idempotency check
        if (!adoptionCandidate) {
            adoptionCandidate = doc;
        }
        else {
            const currentCreatedAt = data.createdAt?.toMillis() || 0;
            const bestCreatedAt = adoptionCandidate.data()?.createdAt?.toMillis() || 0;
            if (currentCreatedAt > bestCreatedAt) {
                adoptionCandidate = doc;
            }
        }
    }
    if (adoptionCandidate) {
        const candidateData = adoptionCandidate.data();
        const adoptedUpdates = {
            name: candidateData.name || trimmedName,
            email: trimmedEmail,
            companyName: candidateData.companyName || trimmedCompanyName,
            vatId: candidateData.vatId || trimmedVatId,
            billingAddress: candidateData.billingAddress || trimmedBillingAddress,
            credits: candidateData.credits || 0,
            totalSpent: candidateData.totalSpent || 0,
            totalPurchased: candidateData.totalPurchased || 0,
            role: candidateData.role || "recruiter",
            adoptedFrom: adoptionCandidate.id,
            adoptedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            createdAt: candidateData.createdAt || firestore_1.FieldValue.serverTimestamp()
        };
        await userRef.set(adoptedUpdates, { merge: true });
        await adoptionCandidate.ref.update({
            archived: true,
            archivedAt: firestore_1.FieldValue.serverTimestamp(),
            mergedInto: uid
        });
        const auditLogs = await adoptionCandidate.ref.collection("creditAuditLog").get();
        if (!auditLogs.empty) {
            const batch = db.batch();
            for (const logDoc of auditLogs.docs) {
                const newLogRef = userRef.collection("creditAuditLog").doc(logDoc.id);
                batch.set(newLogRef, logDoc.data());
                batch.delete(logDoc.ref);
            }
            await batch.commit();
        }
        const profile = {
            uid,
            name: adoptedUpdates.name,
            email: adoptedUpdates.email,
            companyName: adoptedUpdates.companyName,
            vatId: adoptedUpdates.vatId,
            billingAddress: adoptedUpdates.billingAddress,
            credits: adoptedUpdates.credits,
            totalSpent: adoptedUpdates.totalSpent,
            totalPurchased: adoptedUpdates.totalPurchased,
            role: adoptedUpdates.role
        };
        return { uid, created: false, profile, adopted: true };
    }
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        const existingData = userDoc.data() || {};
        const updates = {
            name: trimmedName,
            email: trimmedEmail,
            companyName: trimmedCompanyName,
            vatId: trimmedVatId,
            billingAddress: trimmedBillingAddress,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (!existingData.role) {
            updates.role = "recruiter";
        }
        await userRef.set(updates, { merge: true });
        const profile = {
            uid,
            name: trimmedName,
            email: trimmedEmail,
            companyName: trimmedCompanyName,
            vatId: trimmedVatId,
            billingAddress: trimmedBillingAddress,
            credits: existingData.credits ?? 0,
            totalSpent: existingData.totalSpent ?? 0,
            totalPurchased: existingData.totalPurchased ?? 0,
            role: existingData.role || "recruiter",
        };
        return { uid, created: false, profile };
    }
    else {
        const newUserData = {
            name: trimmedName,
            email: trimmedEmail,
            companyName: trimmedCompanyName,
            vatId: trimmedVatId,
            billingAddress: trimmedBillingAddress,
            role: "recruiter",
            credits: 0,
            totalSpent: 0,
            totalPurchased: 0,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        await userRef.set(newUserData);
        const profile = {
            uid,
            name: trimmedName,
            email: trimmedEmail,
            companyName: trimmedCompanyName,
            vatId: trimmedVatId,
            billingAddress: trimmedBillingAddress,
            credits: 0,
            totalSpent: 0,
            totalPurchased: 0,
            role: "recruiter",
        };
        return { uid, created: true, profile };
    }
});
exports.createClient = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo()) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in or running in demo mode");
    }
    if (_context.auth?.token?.admin !== true && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin to create a client");
    }
    const { name, companyName, email, vatId, credits, reason } = data || {};
    if (!name || typeof name !== "string" || !name.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Full name is required");
    }
    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Company name is required");
    }
    if (!email || typeof email !== "string" || !email.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "Email is required");
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid email format");
    }
    if (typeof credits !== "number" || credits < 0) {
        throw new functions.https.HttpsError("invalid-argument", "Credits must be a non-negative number");
    }
    const db = admin.firestore();
    const trimmedVatId = typeof vatId === "string" ? vatId.trim() : "";
    const trimmedReason = typeof reason === "string" ? reason.trim() : "Promo / testing";
    const userData = {
        name: name.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        vatId: trimmedVatId,
        credits,
        totalSpent: 0,
        role: "recruiter",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    const userRef = await db.collection("users").add(userData);
    await userRef.collection("creditAuditLog").add({
        amount: credits,
        reason: trimmedReason,
        adjustedBy: "admin",
        previousBalance: 0,
        newBalance: credits,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { id: userRef.id };
});
exports.generateB2BInvoice = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo()) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { transactionId, companyName, amount, email } = data;
    if (!transactionId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing transactionId");
    }
    const doc = new pdfkit_1.default();
    const buffers = [];
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
        if (companyName)
            doc.text(`Company: ${companyName}`);
        if (email)
            doc.text(`Email: ${email}`);
        if (amount)
            doc.text(`Amount: $${amount}`);
        doc.moveDown();
        doc.text('Thank you for your business!');
        doc.end();
    });
});
const crypto = __importStar(require("crypto"));
exports.topUpCredits = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    if (_context.auth?.token?.admin !== true) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can top up credits");
    }
    const { amount, recruiterId: payloadRecruiterId } = data || {};
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Valid amount required");
    }
    const uid = await (0, auth_1.resolveRecruiterId)(_context, payloadRecruiterId);
    const recruiterRef = admin.firestore().collection("users").doc(uid);
    const doc = await recruiterRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Recruiter not found");
    }
    try {
        const targetAuth = await admin.auth().getUser(uid);
        if (targetAuth.customClaims?.admin === true) {
            throw new functions.https.HttpsError("invalid-argument", "Admins cannot top up credits directly");
        }
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        if (err?.code !== 'auth/user-not-found')
            throw err;
        // Doc-only account → not an admin → continue
    }
    await recruiterRef.set({
        credits: firestore_1.FieldValue.increment(amount)
    }, { merge: true });
    return { success: true };
});
exports.createAssessmentLink = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { roleTitle, candidateName, candidateEmail, recruiterId: payloadRecruiterId } = data || {};
    if (!roleTitle)
        throw new functions.https.HttpsError("invalid-argument", "Missing roleTitle");
    const recruiterId = await (0, auth_1.resolveRecruiterId)(_context, payloadRecruiterId);
    const recruiterRef = admin.firestore().collection("users").doc(recruiterId);
    const doc = await recruiterRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Recruiter not found");
    }
    try {
        const targetAuthRecord = await admin.auth().getUser(recruiterId);
        if (targetAuthRecord.customClaims?.admin === true) {
            throw new functions.https.HttpsError("invalid-argument", "Admins cannot create assessment links directly");
        }
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        if (err?.code !== 'auth/user-not-found')
            throw err;
        // Doc-only account → not an admin → continue
    }
    const credits = doc.data()?.credits || 0;
    if (credits <= 0) {
        throw new functions.https.HttpsError("failed-precondition", "Insufficient credits");
    }
    // Deduct 1 credit immediately
    await recruiterRef.update({
        credits: firestore_1.FieldValue.increment(-1)
    });
    const candRef = admin.firestore().collection("candidates").doc();
    await candRef.set({
        appliedRole: roleTitle,
        name: candidateName || "",
        email: candidateEmail || "",
        status: "Invited",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        recruiterId
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
exports.deleteCandidate = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { candidateId } = data || {};
    if (!candidateId || typeof candidateId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
    }
    const candRef = admin.firestore().collection("candidates").doc(candidateId);
    const doc = await candRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Candidate not found");
    }
    const isAdmin = _context.auth?.token?.admin === true;
    const isRecordOwner = doc.data()?.recruiterId === _context.auth?.uid;
    if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
    }
    await candRef.delete();
    return { success: true };
});
const ALLOWED_CANDIDATE_STATUSES = new Set([
    "Invited", "In Progress", "Shortlisted", "Interviewing", "Rejected", "Completed", "Abandoned",
]);
exports.updateCandidateStatus = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
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
    const isAdmin = _context.auth?.token?.admin === true;
    const isRecordOwner = doc.data()?.recruiterId === _context.auth?.uid;
    if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
    }
    await candRef.update({ status });
    return { success: true };
});
exports.updateCandidate = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { candidateId, name, email, appliedRole } = data || {};
    if (!candidateId || typeof candidateId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
    }
    const updates = {};
    if (name !== undefined) {
        if (typeof name !== "string")
            throw new functions.https.HttpsError("invalid-argument", "Invalid name");
        const trimmed = name.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "Name cannot be empty");
        updates.name = trimmed;
    }
    if (email !== undefined) {
        if (typeof email !== "string")
            throw new functions.https.HttpsError("invalid-argument", "Invalid email");
        const trimmed = email.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "Email cannot be empty");
        updates.email = trimmed;
    }
    if (appliedRole !== undefined) {
        if (typeof appliedRole !== "string")
            throw new functions.https.HttpsError("invalid-argument", "Invalid appliedRole");
        const trimmed = appliedRole.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "Applied role cannot be empty");
        updates.appliedRole = trimmed;
    }
    const candRef = admin.firestore().collection("candidates").doc(candidateId);
    const doc = await candRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Candidate not found");
    }
    const isAdmin = _context.auth?.token?.admin === true;
    const isRecordOwner = doc.data()?.recruiterId === _context.auth?.uid;
    if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
    }
    if (Object.keys(updates).length > 0) {
        await candRef.update(updates);
    }
    return { success: true };
});
exports.bulkDeleteCandidates = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
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
    const existingIds = [];
    const missingIds = [];
    const isAdmin = _context.auth?.token?.admin === true;
    const uid = _context.auth?.uid;
    docs.forEach((doc, i) => {
        if (doc.exists) {
            const isRecordOwner = doc.data()?.recruiterId === uid;
            if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
                throw new functions.https.HttpsError("permission-denied", `You do not own candidate ${candidateIds[i]}`);
            }
            existingIds.push(candidateIds[i]);
        }
        else {
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
exports.startSession = functions.https.onCall(async (data, _context) => {
    const { assessmentId } = data;
    if (!assessmentId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing assessmentId");
    }
    try {
        const session = (0, session_1.resolveSession)(assessmentId, presift_bank_1.bank);
        const sessionKeys = (0, session_1.buildSessionKeys)(session, presift_bank_1.bank);
        const sessionToken = crypto.randomUUID();
        // Capture the candidate's identity from the candidate record (if it exists
        // in THIS database). submitAssessment later uses this as the fallback
        // identity for the result doc, so a completed result is never written as an
        // anonymous invisible orphan — even if the candidate doc is deleted between
        // session start and submission (e.g. by the demo seeder).
        let identity = {
            candidateName: "",
            candidateEmail: "",
            appliedRole: "",
            candidateRecruiterId: "",
        };
        try {
            const candDoc = await admin.firestore().collection("candidates").doc(assessmentId).get();
            if (candDoc.exists) {
                const c = candDoc.data();
                // --- Archived gate: block new sessions for archived candidates ---
                if (c.archived === true) {
                    throw new functions.https.HttpsError("failed-precondition", "This candidate is archived and cannot start a new assessment session.");
                }
                identity = {
                    candidateName: c.name || "",
                    candidateEmail: c.email || "",
                    appliedRole: c.appliedRole || "",
                    candidateRecruiterId: c.recruiterId || "",
                };
            }
        }
        catch (err) {
            // Re-throw intentional gate errors (e.g. archived candidate); swallow
            // only genuine read failures so the session still starts in that case.
            if (err instanceof functions.https.HttpsError)
                throw err;
            // Best-effort capture: if the candidate read fails (e.g. the link was
            // created against a different database/emulator), the session still
            // starts; submitAssessment will then fail loudly instead of producing an
            // invisible orphan result.
            console.error("startSession: could not read candidate identity for", assessmentId, err);
        }
        // Store session keys securely on the server
        await admin.firestore().collection("sessions").doc(session.sessionId).set({
            keys: sessionKeys,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            assessmentId,
            sessionToken,
            answers: [],
            integrityEvents: [],
            ...identity,
        });
        // Return the safe items and token to the client (never _keys)
        return { sessionId: session.sessionId, items: session.items, wleisItems: session.wleisItems, sessionToken, smileTask: session.smileTask };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error("Session generation error:", error);
        throw new functions.https.HttpsError("internal", "Failed to start session.");
    }
});
exports.submitAssessment = functions.https.onCall(async (data, _context) => {
    try {
        const validData = (0, submission_1.validateSubmission)(data, presift_bank_1.bank);
        const sessionDoc = await admin.firestore().collection("sessions").doc(validData.sessionId).get();
        if (!sessionDoc.exists) {
            throw new functions.https.HttpsError("not-found", "This test session has expired or already been submitted.");
        }
        const { keys, assessmentId, integrityEvents, candidateName, candidateEmail, appliedRole, candidateRecruiterId } = sessionDoc.data();
        const submission = {
            sessionId: validData.sessionId,
            answers: validData.icar,
            wleisAnswers: validData.wleis,
            smileAnswers: validData.smileAnswers,
        };
        const scoreResult = (0, submission_1.processSubmission)(submission, keys);
        let smileScoringResult = null;
        if (validData.smileAnswers && presift_bank_1.bank.smileTask?.trials) {
            // WLEIS OEA is a sum of 4 items (each 1-7), so mean is 1-7.
            const rawOea1to7 = scoreResult.wleis?.rawScores?.OEA !== undefined ? (scoreResult.wleis.rawScores.OEA / 4) : 4.0;
            // Convert the 1-7 OEA mean to the 1-5 calibration scale.
            // scoreResult.smile.calibration.rawOea will now reflect this 1-5 scale.
            const rawOea = 1 + ((rawOea1to7 - 1) / 6) * 4;
            const smileTrials = presift_bank_1.bank.smileTask.trials.map((t) => ({
                trialId: t.trialId,
                start: t.start,
                end: t.end,
                groundTruth: (t.groundTruth === 'fake' ? 'fake' : 'genuine'),
            }));
            smileScoringResult = (0, smile_1.scoreSmileTask)(validData.smileAnswers, smileTrials, rawOea);
        }
        let fitBadge = "🔴 Low Fit";
        if (scoreResult.icar.percentile >= 80)
            fitBadge = "🟢 Strong Fit";
        else if (scoreResult.icar.percentile >= 50)
            fitBadge = "🟡 Conditional Fit";
        const resultPayload = {
            scoreResult: {
                ...scoreResult,
                ...(smileScoringResult ? { smile: smileScoringResult } : {}),
            },
            ...(smileScoringResult ? { smileResult: smileScoringResult } : {}),
            fitBadge,
            status: "Completed",
            reportStatus: "completed",
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            completionDate: new Date().toISOString(),
            integrityEvents: integrityEvents || [],
        };
        const candRef = admin.firestore().collection("candidates").doc(assessmentId);
        const candDoc = await candRef.get();
        if (candDoc.exists) {
            await candRef.set(resultPayload, { merge: true });
        }
        else {
            // No candidate record in this database. If startSession captured the
            // candidate's identity (the candidate doc existed at session start), we
            // reconstruct a NAMED result doc so the dashboard query can always find
            // it. Without a recruiterId the result would be invisible — fail loudly
            // instead of writing an anonymous orphan.
            if (!candidateRecruiterId) {
                throw new functions.https.HttpsError("failed-precondition", "This assessment link is invalid — no candidate record was found for it. Please contact the recruiter to receive a new link.");
            }
            await candRef.set({
                assessmentId,
                name: candidateName || "",
                email: candidateEmail || "",
                appliedRole: appliedRole || "",
                recruiterId: candidateRecruiterId,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                ...resultPayload,
            }, { merge: true });
        }
        // Mark session as used or delete it
        await sessionDoc.ref.delete();
        return { success: true, scoreResult: resultPayload.scoreResult };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error("Submission error:", error);
        throw new functions.https.HttpsError("invalid-argument", "Failed to evaluate candidate.");
    }
});
exports.checkAbandonedSessions = functions.pubsub.schedule("every 24 hours").onRun(async (_context) => {
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
                credits: firestore_1.FieldValue.increment(1)
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
            }
            catch (err) {
                console.error("Email failed for", candidateData.email, err);
            }
        }
    }
    await batch.commit();
    console.log(`Abandoned ${snapshot.size} sessions.`);
});
// ---------------------------------------------------------------------------
// Admin/Recruiter callables — many-to-many candidate↔client management
// ---------------------------------------------------------------------------
exports.updateCandidateClients = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { candidateId, clientIds } = data || {};
    // --- Validate candidateId ---
    if (!candidateId || typeof candidateId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "candidateId must be a non-empty string");
    }
    // --- Validate clientIds array ---
    if (!Array.isArray(clientIds)) {
        throw new functions.https.HttpsError("invalid-argument", "clientIds must be an array");
    }
    if (clientIds.length < 1 || clientIds.length > 50) {
        throw new functions.https.HttpsError("invalid-argument", "clientIds must contain between 1 and 50 entries");
    }
    for (const id of clientIds) {
        if (typeof id !== "string" || !id.trim()) {
            throw new functions.https.HttpsError("invalid-argument", "Each clientId must be a non-empty string");
        }
    }
    if (new Set(clientIds).size !== clientIds.length) {
        throw new functions.https.HttpsError("invalid-argument", "clientIds must not contain duplicates");
    }
    const db = admin.firestore();
    // --- Confirm candidate doc exists ---
    const candRef = db.collection("candidates").doc(candidateId);
    const candDoc = await candRef.get();
    if (!candDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Candidate not found");
    }
    const isAdmin = _context.auth?.token?.admin === true;
    const isRecordOwner = candDoc.data()?.recruiterId === _context.auth?.uid;
    if (!isAdmin && !isRecordOwner && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "You do not own this candidate.");
    }
    // --- Verify every clientId exists in users/ ---
    const userRefs = clientIds.map((id) => db.collection("users").doc(id));
    const userDocs = await db.getAll(...userRefs);
    const unknownIds = clientIds.filter((_id, i) => !userDocs[i].exists);
    if (unknownIds.length > 0) {
        throw new functions.https.HttpsError("invalid-argument", `Unknown clientIds: ${unknownIds.join(", ")}`);
    }
    // --- Update candidate (do NOT touch recruiterId) ---
    await candRef.update({ clientIds, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    return { candidateId, clientIds };
});
exports.adjustClientCredits = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { clientId, amount, reason } = data || {};
    // Validate clientId
    if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "clientId must be a non-empty string");
    }
    const trimmedClientId = clientId.trim();
    // Validate amount
    if (typeof amount !== "number" || amount === 0) {
        throw new functions.https.HttpsError("invalid-argument", "amount must be a non-zero number");
    }
    // Validate reason
    if (!reason || typeof reason !== "string" || !reason.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "reason must be a non-empty string");
    }
    const trimmedReason = reason.trim();
    // Admin validation
    if (_context.auth?.token?.admin !== true && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin to adjust credits");
    }
    const db = admin.firestore();
    const clientRef = db.collection("users").doc(trimmedClientId);
    let newBalance = 0;
    await db.runTransaction(async (t) => {
        const doc = await t.get(clientRef);
        if (!doc.exists) {
            throw new functions.https.HttpsError("not-found", "Client not found");
        }
        const currentCredits = doc.data()?.credits || 0;
        newBalance = Math.max(0, currentCredits + amount);
        t.update(clientRef, { credits: newBalance, updatedAt: firestore_1.FieldValue.serverTimestamp() });
        const auditRef = clientRef.collection("creditAuditLog").doc();
        t.set(auditRef, {
            amount,
            reason: trimmedReason,
            adjustedBy: "admin",
            previousBalance: currentCredits,
            newBalance,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
    return { clientId: trimmedClientId, newBalance };
});
exports.updateClient = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { clientId, companyName, email, vatId } = data || {};
    // --- Validate clientId ---
    if (!clientId || typeof clientId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "clientId must be a non-empty string");
    }
    // --- At least one editable field must be provided ---
    if (companyName === undefined && email === undefined && vatId === undefined) {
        throw new functions.https.HttpsError("invalid-argument", "At least one of companyName, email, or vatId must be provided");
    }
    const updates = {};
    if (companyName !== undefined) {
        if (typeof companyName !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "companyName must be a string");
        }
        const trimmed = companyName.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "companyName cannot be empty");
        updates.companyName = trimmed;
    }
    if (email !== undefined) {
        if (typeof email !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "email must be a string");
        }
        const trimmed = email.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "email cannot be empty");
        if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
            throw new functions.https.HttpsError("invalid-argument", "email format is invalid");
        }
        updates.email = trimmed;
    }
    if (vatId !== undefined) {
        if (typeof vatId !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "vatId must be a string");
        }
        const trimmed = vatId.trim();
        if (!trimmed)
            throw new functions.https.HttpsError("invalid-argument", "vatId cannot be empty");
        updates.vatId = trimmed;
    }
    // --- Confirm client doc exists ---
    const clientRef = admin.firestore().collection("users").doc(clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Client not found");
    }
    // --- Apply update (updatedAt only; never credits, totalSpent, role, createdAt, archived) ---
    await clientRef.update({ ...updates, updatedAt: firestore_1.FieldValue.serverTimestamp() });
    const updated = await clientRef.get();
    const d = updated.data() || {};
    return {
        clientId,
        companyName: d.companyName ?? null,
        email: d.email ?? null,
        vatId: d.vatId ?? null,
        updatedAt: d.updatedAt ?? null,
    };
});
exports.archiveClient = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { clientId, archived } = data || {};
    // --- Validate clientId ---
    if (!clientId || typeof clientId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "clientId must be a non-empty string");
    }
    // --- Validate archived is boolean ---
    if (typeof archived !== "boolean") {
        throw new functions.https.HttpsError("invalid-argument", "archived must be a boolean");
    }
    // --- Confirm client doc exists ---
    const clientRef = admin.firestore().collection("users").doc(clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Client not found");
    }
    // --- Soft-archive or unarchive ---
    await clientRef.update({
        archived,
        archivedAt: archived ? firestore_1.FieldValue.serverTimestamp() : firestore_1.FieldValue.delete(),
    });
    return { clientId, archived };
});
exports.archiveCandidate = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { candidateId, archived } = data || {};
    // --- Validate candidateId ---
    if (!candidateId || typeof candidateId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "candidateId must be a non-empty string");
    }
    // --- Validate archived is boolean ---
    if (typeof archived !== "boolean") {
        throw new functions.https.HttpsError("invalid-argument", "archived must be a boolean");
    }
    // --- Confirm candidate doc exists ---
    const candRef = admin.firestore().collection("candidates").doc(candidateId);
    const candDoc = await candRef.get();
    if (!candDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Candidate not found");
    }
    // --- Soft-archive or unarchive (never touch status/recruiterId/clientIds/scores/sessions/results) ---
    await candRef.update({
        archived,
        archivedAt: archived ? firestore_1.FieldValue.serverTimestamp() : firestore_1.FieldValue.delete(),
    });
    return { candidateId, archived };
});
// ---------------------------------------------------------------------------
exports.integrity = functions.https.onRequest(async (req, res) => {
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
    }
    catch (error) {
        console.error("Integrity log error:", error);
        res.status(500).send('Internal Server Error');
    }
});
exports.getCandidateStatus = functions.https.onCall(async (data, _context) => {
    const { candidateId } = data || {};
    if (!candidateId || typeof candidateId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Missing candidateId");
    }
    const candRef = admin.firestore().collection("candidates").doc(candidateId);
    const doc = await candRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError("not-found", "Candidate not found");
    }
    const cData = doc.data() || {};
    return {
        name: cData.name || "",
        appliedRole: cData.appliedRole || "",
        status: cData.status || ""
    };
});
exports.deleteClient = functions.https.onCall(async (data, _context) => {
    if (!_context.auth && !allowAnonDemo())
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    const { clientId } = data || {};
    if (!clientId || typeof clientId !== "string" || !clientId.trim()) {
        throw new functions.https.HttpsError("invalid-argument", "clientId must be a non-empty string");
    }
    // Admin validation
    const db = admin.firestore();
    if (_context.auth?.token?.admin !== true && !allowAnonDemo()) {
        throw new functions.https.HttpsError("permission-denied", "Must be an admin to delete a client");
    }
    const clientRef = db.collection("users").doc(clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Client not found");
    }
    const batch = db.batch();
    // Delete campaigns
    const campaignsSnap = await db.collection("campaigns").where("recruiterId", "==", clientId).get();
    campaignsSnap.forEach(doc => batch.delete(doc.ref));
    // Delete candidates
    const candidatesSnap = await db.collection("candidates").where("recruiterId", "==", clientId).get();
    candidatesSnap.forEach(doc => batch.delete(doc.ref));
    // Delete creditAuditLog
    const auditSnap = await clientRef.collection("creditAuditLog").get();
    auditSnap.forEach(doc => batch.delete(doc.ref));
    // Delete client profile
    batch.delete(clientRef);
    await batch.commit();
    return { success: true, deletedCandidates: candidatesSnap.size, deletedCampaigns: campaignsSnap.size };
});
//# sourceMappingURL=index.js.map