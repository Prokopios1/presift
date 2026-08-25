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
exports.resolveRecruiterId = resolveRecruiterId;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
function demoConfig() {
    try {
        return functions.config().demo || {};
    }
    catch {
        return {};
    }
}
const allowAnonDemo = () => process.env.FUNCTIONS_EMULATOR === "true" || demoConfig().allow_anon === "true";
async function resolveRecruiterId(context, payloadRecruiterId) {
    const callerUid = context.auth?.uid;
    if (!callerUid) {
        if (allowAnonDemo()) {
            if (!payloadRecruiterId || !payloadRecruiterId.trim()) {
                throw new functions.https.HttpsError("invalid-argument", "Missing recruiterId");
            }
            return payloadRecruiterId.trim();
        }
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    if (payloadRecruiterId && payloadRecruiterId.trim() && payloadRecruiterId.trim() !== callerUid) {
        const db = admin.firestore();
        // Fetch the caller to ensure they are an admin
        const callerDoc = await db.collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            throw new functions.https.HttpsError("permission-denied", "You do not have permission to perform this action on behalf of another user.");
        }
        // Fetch the target user to ensure we are not impersonating another admin
        const targetId = payloadRecruiterId.trim();
        const targetDoc = await db.collection('users').doc(targetId).get();
        if (targetDoc.exists && targetDoc.data()?.role === 'admin') {
            throw new functions.https.HttpsError("permission-denied", "Admins cannot impersonate other admins.");
        }
        return targetId;
    }
    return callerUid;
}
//# sourceMappingURL=auth.js.map