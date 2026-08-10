/**
 * One-time backfill: reassign candidates with recruiterId == "demo_user"
 * to "demo_recruiter" so they appear on the dashboard.
 *
 * Run with: node scripts/backfill-recruiter-id.mjs
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Uses Application Default Credentials (gcloud auth application-default login).
// projectId is explicit because without it the SDK infers no project from ADC in this env.
initializeApp({ projectId: 'presift' });

const db = getFirestore();

async function backfill() {
  // 1. Migrate candidate docs
  const candidatesSnap = await db
    .collection('candidates')
    .where('recruiterId', '==', 'demo_user')
    .get();

  if (candidatesSnap.empty) {
    console.log('No candidate docs with recruiterId == "demo_user" found — nothing to migrate.');
  } else {
    const batch = db.batch();
    candidatesSnap.docs.forEach(doc => {
      console.log(`  Migrating candidate: ${doc.id}`);
      batch.update(doc.ref, { recruiterId: 'demo_recruiter' });
    });
    await batch.commit();
    console.log(`✅ Migrated ${candidatesSnap.size} candidate doc(s).`);
  }

  // 2. Merge credits from users/demo_user into users/demo_recruiter
  const demoUserDoc = await db.collection('users').doc('demo_user').get();
  if (demoUserDoc.exists) {
    const credits = demoUserDoc.data()?.credits || 0;
    if (credits > 0) {
      await db.collection('users').doc('demo_recruiter').set(
        { credits: FieldValue.increment(credits) },
        { merge: true }
      );
      console.log(`✅ Merged ${credits} credit(s) from users/demo_user → users/demo_recruiter.`);
    }
    // Leave users/demo_user intact (just zeroed or keep for audit); don't delete.
    console.log('ℹ️  users/demo_user left intact for audit trail.');
  } else {
    console.log('ℹ️  No users/demo_user doc found — no credit migration needed.');
  }

  console.log('Done.');
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
