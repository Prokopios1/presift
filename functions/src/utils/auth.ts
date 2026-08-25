import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

function demoConfig(): { allow_anon?: string } {
  try {
    return (functions.config().demo as { allow_anon?: string }) || {};
  } catch {
    return {};
  }
}

const allowAnonDemo = (): boolean =>
  process.env.FUNCTIONS_EMULATOR === "true" || demoConfig().allow_anon === "true";

export async function resolveRecruiterId(context: functions.https.CallableContext, payloadRecruiterId?: string): Promise<string> {
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
