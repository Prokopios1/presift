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
exports.seedDemoData = void 0;
exports.buildDemoData = buildDemoData;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
function buildDemoData() {
    const recruiter = {
        email: "demo_recruiter@presift.app",
        credits: 5,
        companyName: "Acme Corp (Demo)",
        vatId: "DE123456789",
        totalSpent: 40,
        totalPurchased: 13,
        role: "recruiter",
    };
    const owner = {
        email: "prokopios@presift.app",
        credits: 999,
        companyName: "PreSift Admin",
        vatId: "",
        totalSpent: 0,
        totalPurchased: 0,
        role: "admin",
    };
    const assessments = [
        { active: true, roleTitle: "Senior Frontend Engineer" },
        { active: true, roleTitle: "Backend Developer" },
        { active: true, roleTitle: "Product Designer" },
    ];
    const score = (pct, std, sea = 22, oea = 20, uoe = 21, roe = 19) => ({
        icar: {
            rawScore: Math.round(pct / 6.25),
            maxRawScore: 16,
            percentile: pct,
            standardScore: std,
            theta: (std - 100) / 15,
            standardError: 0.5,
            domainScores: { numerical: Math.round(pct / 25), verbal: Math.round(pct / 30), abstract: Math.round(pct / 28), spatial: Math.round(pct / 26) },
        },
        wleis: { rawScores: { SEA: sea, OEA: oea, UOE: uoe, ROE: roe, Total: sea + oea + uoe + roe } },
    });
    const now = new Date().toISOString();
    const candidates = [
        // 2x 🟢 Strong Fit
        { name: "Alice Strong", appliedRole: "Senior Frontend Engineer", status: "Completed", completionDate: now, duration: 1800, isLocked: false, email: "alice@example.com", integrityEvents: [], fitBadge: "🟢 Strong Fit", scoreResult: score(95, 125, 26, 24, 25, 27) },
        { name: "Bob Stronger", appliedRole: "Backend Developer", status: "Completed", completionDate: now, duration: 2000, isLocked: false, email: "bob@example.com", integrityEvents: [], fitBadge: "🟢 Strong Fit", scoreResult: score(90, 120, 24, 22, 23, 25) },
        // 3x 🟡 Conditional Fit
        { name: "Charlie Conditional", appliedRole: "Product Designer", status: "Completed", completionDate: now, duration: 1500, isLocked: false, email: "charlie@example.com", integrityEvents: [], fitBadge: "🟡 Conditional Fit", scoreResult: score(70, 108, 20, 18, 19, 17) },
        { name: "Dave Conditional", appliedRole: "Senior Frontend Engineer", status: "Completed", completionDate: now, duration: 1600, isLocked: false, email: "dave@example.com", integrityEvents: [], fitBadge: "🟡 Conditional Fit", scoreResult: score(65, 106, 18, 16, 20, 18) },
        { name: "Eve Conditional", appliedRole: "Backend Developer", status: "Completed", completionDate: now, duration: 1700, isLocked: false, email: "eve@example.com", integrityEvents: [], fitBadge: "🟡 Conditional Fit", scoreResult: score(55, 102, 17, 19, 16, 15) },
        // 2x 🔴 Low Fit
        { name: "Grace Low", appliedRole: "Product Designer", status: "Completed", completionDate: now, duration: 1900, isLocked: false, email: "grace@example.com", integrityEvents: [], fitBadge: "🔴 Low Fit", scoreResult: score(20, 87, 12, 10, 11, 13) },
        { name: "Ivan Low", appliedRole: "Backend Developer", status: "Completed", completionDate: now, duration: 2100, isLocked: false, email: "ivan@example.com", integrityEvents: [], fitBadge: "🔴 Low Fit", scoreResult: score(15, 83, 10, 11, 9, 12) },
        // 1x 🔒 Paywall/Locked
        { name: "Frank Pending", appliedRole: "Senior Frontend Engineer", status: "Pending", completionDate: now, duration: 0, isLocked: true, email: "frank@example.com", integrityEvents: [], fitBadge: "🔒 Locked", scoreResult: score(50, 100) },
        // 1x ⚠️ Integrity Flag
        { name: "Harry Flag", appliedRole: "Senior Frontend Engineer", status: "Completed", completionDate: now, duration: 1850, isLocked: false, email: "harry@example.com", integrityEvents: [{ type: "blur", at: Date.now() - 10000 }, { type: "blur", at: Date.now() - 5000 }, { type: "blur", at: Date.now() - 1000 }], fitBadge: "⚠️ Integrity Flag", scoreResult: score(35, 93, 14, 13, 12, 11) },
    ];
    return { recruiter, owner, assessments, candidates };
}
exports.seedDemoData = functions.https.onCall(async (_data, _context) => {
    const db = admin.firestore();
    const demo = buildDemoData();
    const recruiterId = "demo_recruiter";
    await db.collection("users").doc(recruiterId).set(demo.recruiter);
    await db.collection("users").doc("owner_prokopios").set(demo.owner);
    const batch = db.batch();
    demo.assessments.forEach((a, i) => {
        const docRef = db.collection("assessments").doc(`demo_assessment_${i}`);
        batch.set(docRef, { ...a, recruiterId, createdAt: firestore_1.FieldValue.serverTimestamp() });
    });
    const oldCandidates = await db.collection("candidates").where("recruiterId", "==", recruiterId).get();
    oldCandidates.docs.forEach(doc => batch.delete(doc.ref));
    demo.candidates.forEach((c, i) => {
        const docRef = db.collection("candidates").doc(`demo_cand_${i}`);
        batch.set(docRef, { ...c, recruiterId });
    });
    await batch.commit();
    return { success: true, count: demo.candidates.length };
});
//# sourceMappingURL=seeder.js.map