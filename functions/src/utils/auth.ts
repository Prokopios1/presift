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
    // Caller must be an admin (via Firebase Auth custom claim, NOT Firestore doc role)
    if (context.auth?.token?.admin !== true) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to perform this action on behalf of another user.");
    }

    // Verify the target is not another admin (via Auth custom claims).
    // Doc-only accounts (created via "Add Client") have no Auth record —
    // getUser rejects with auth/user-not-found; treat them as non-admin.
    const targetId = payloadRecruiterId.trim();
    try {
      const targetUser = await admin.auth().getUser(targetId);
      if (targetUser.customClaims?.admin === true) {
        throw new functions.https.HttpsError("permission-denied", "Admins cannot impersonate other admins.");
      }
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      if (err?.code !== 'auth/user-not-found') throw err;
      // No Auth record → not an admin → continue
    }

    return targetId;
  }

  return callerUid;
}
