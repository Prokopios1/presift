import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import Stripe from "stripe";

// Stripe config, read from functions config (set with:
// firebase functions:config:set stripe.secret_key=... stripe.webhook_secret=...)
function stripeConfig(): { secret_key?: string; webhook_secret?: string } {
  try {
    return (functions.config().stripe as { secret_key?: string; webhook_secret?: string }) || {};
  } catch {
    return {};
  }
}

function getStripe(): Stripe {
  const key = stripeConfig().secret_key;
  if (!key) {
    throw new functions.https.HttpsError("failed-precondition", "Stripe is not configured");
  }
  return new Stripe(key);
}

export const createCheckoutSession = functions.https.onCall(async (data, _context) => {
  // Support both new `quantity` and legacy `pack`
  const quantity = parseInt(String(data?.quantity || data?.pack), 10);
  if (isNaN(quantity) || quantity < 1 || quantity > 200) {
    throw new functions.https.HttpsError("invalid-argument", "Valid quantity required (1-200)");
  }
  
  const amountCents = quantity * 500; // €5.00 = 500 cents
  const label = `${quantity} Candidate Credits`;

  const recipient = typeof data?.uid === "string" && data.uid.trim() ? data.uid.trim() : "demo_user";
  const origin = typeof data?.origin === "string" && /^https?:\/\//.test(data.origin)
    ? data.origin.replace(/\/$/, "")
    : "http://localhost:5173";

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: typeof data?.email === "string" && data.email.includes("@") ? data.email : undefined,
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
    metadata: { uid: recipient, credits: String(quantity), quantity: String(quantity) },
  });

  return { url: session.url };
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const secret = stripeConfig().webhook_secret;
  const sig = req.headers["stripe-signature"];
  if (!secret || typeof sig !== "string") {
    res.status(400).send("Missing Stripe webhook secret or signature");
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid || session.client_reference_id;
    const credits = parseInt(session.metadata?.credits || "0", 10);
    if (uid && credits > 0) {
      await admin.firestore().collection("users").doc(uid).set(
        { credits: FieldValue.increment(credits) },
        { merge: true }
      );
      console.log(`Stripe: credited ${credits} credits to ${uid} (session ${session.id})`);
    }
  }

  res.json({ received: true });
});
