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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createCheckoutSession = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const stripe_1 = __importDefault(require("stripe"));
// Stripe config, read from functions config (set with:
// firebase functions:config:set stripe.secret_key=... stripe.webhook_secret=...)
function stripeConfig() {
    try {
        return functions.config().stripe || {};
    }
    catch {
        return {};
    }
}
function getStripe() {
    const key = stripeConfig().secret_key;
    if (!key) {
        throw new functions.https.HttpsError("failed-precondition", "Stripe is not configured");
    }
    return new stripe_1.default(key);
}
exports.createCheckoutSession = functions.https.onCall(async (data, _context) => {
    // Support both new `quantity` and legacy `pack`
    const quantity = parseInt(String(data?.quantity || data?.pack), 10);
    if (isNaN(quantity) || quantity < 1 || quantity > 200) {
        throw new functions.https.HttpsError("invalid-argument", "Valid quantity required (1-200)");
    }
    const isPromo = data?.isPromo === true && quantity === 1;
    const amountCents = isPromo ? 100 : quantity * 500; // €1.00 for promo, else €5.00/credit
    const label = isPromo ? '1 Candidate Credit (Promo)' : `${quantity} Candidate Credits`;
    const recipient = typeof data?.uid === "string" && data.uid.trim() ? data.uid.trim() : "demo_user";
    const origin = typeof data?.origin === "string" && /^https?:\/\//.test(data.origin)
        ? data.origin.replace(/\/$/, "")
        : "http://localhost:5173";
    // Auto-wire identity from caller input or registered recruiter profile
    let resolvedEmail = typeof data?.email === "string" && data.email.includes("@") ? data.email.trim() : undefined;
    let resolvedCompanyName = typeof data?.companyName === "string" && data.companyName.trim() ? data.companyName.trim() : undefined;
    let resolvedVatId = typeof data?.vatId === "string" && data.vatId.trim()
        ? data.vatId.trim()
        : (typeof data?.vat === "string" && data.vat.trim() ? data.vat.trim() : undefined);
    let resolvedBillingAddress = typeof data?.billingAddress === "string" && data.billingAddress.trim() ? data.billingAddress.trim() : undefined;
    if (recipient) {
        try {
            const userDoc = await admin.firestore().collection("users").doc(recipient).get();
            if (userDoc.exists) {
                const userData = userDoc.data() || {};
                if (!resolvedEmail && typeof userData.email === "string" && userData.email.includes("@")) {
                    resolvedEmail = userData.email.trim();
                }
                if (!resolvedCompanyName && typeof userData.companyName === "string" && userData.companyName.trim()) {
                    resolvedCompanyName = userData.companyName.trim();
                }
                if (!resolvedVatId && typeof userData.vatId === "string" && userData.vatId.trim()) {
                    resolvedVatId = userData.vatId.trim();
                }
                if (!resolvedBillingAddress && typeof userData.billingAddress === "string" && userData.billingAddress.trim()) {
                    resolvedBillingAddress = userData.billingAddress.trim();
                }
            }
        }
        catch (err) {
            console.warn("createCheckoutSession: profile lookup error for", recipient, err);
        }
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: resolvedEmail,
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: "eur",
                    unit_amount: amountCents,
                    product_data: { name: label },
                },
            },
        ],
        success_url: `${origin}/dashboard?payment=success`,
        cancel_url: `${origin}/?payment=cancelled`,
        client_reference_id: recipient,
        metadata: {
            uid: recipient,
            credits: String(quantity),
            quantity: String(quantity),
            companyName: resolvedCompanyName || "",
            vatId: resolvedVatId || "",
            email: resolvedEmail || "",
        },
    });
    return { url: session.url };
});
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const secret = stripeConfig().webhook_secret;
    const sig = req.headers["stripe-signature"];
    if (!secret || typeof sig !== "string") {
        res.status(400).send("Missing Stripe webhook secret or signature");
        return;
    }
    let event;
    try {
        event = getStripe().webhooks.constructEvent(req.rawBody, sig, secret);
    }
    catch (err) {
        res.status(400).send(`Webhook signature verification failed: ${err.message}`);
        return;
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const uid = session.metadata?.uid || session.client_reference_id;
        const credits = parseInt(session.metadata?.credits || "0", 10);
        if (uid && credits > 0) {
            await admin.firestore().collection("users").doc(uid).set({ credits: firestore_1.FieldValue.increment(credits) }, { merge: true });
            console.log(`Stripe: credited ${credits} credits to ${uid} (session ${session.id})`);
        }
    }
    res.json({ received: true });
});
//# sourceMappingURL=stripe.js.map