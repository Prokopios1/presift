// Seed synthetic LEGACY data into the local Firestore emulator to test
// migrate-auth.mjs batch-chunking logic.
//
// Usage (emulator must be running):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 FIREBASE_PROJECT_ID=demo-b2b \
//     node functions/scripts/seed-legacy-data.mjs
//
// What it creates:
//   - 505 legacy user docs in `users`, each with a 36-char UUID as the doc ID
//     (mimics the pre-Firebase-Auth localStorage IDs), plus email/name/company.
//   - 505 candidate docs in `candidates`, ALL pointing at ONE legacy user UUID.
//
// Why all candidates point at a single user: migrate-auth.mjs chunks writes
// per-user (a user's ops = 1 set + 1 delete + N candidate/campaign updates),
// so the only way to cross Firestore's 500-write batch limit is to give one
// user more than ~498 relational docs. 505 candidates -> 507 ops for that
// user -> exercises the 499-per-chunk splitting (2 chunks: 499 + 8).

import admin from 'firebase-admin';
import crypto from 'crypto';

// Safety: this script is emulator-only. Refuse to run otherwise.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run: FIRESTORE_EMULATOR_HOST not set (this script is emulator-only).');
  process.exit(1);
}

const NUM_USERS = 505;
const NUM_CANDIDATES = 505; // >= 500 so the target user crosses the batch limit

const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-b2b';
admin.initializeApp({ projectId });
const db = admin.firestore();

const CHUNK = 499; // Firestore batch limit is 500 writes; keep headroom.

async function clearCollection(name) {
  const snap = await db.collection(name).get();
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + CHUNK)) batch.delete(db.collection(name).doc(id));
    await batch.commit();
  }
  if (ids.length) console.log(`  Cleared ${ids.length} pre-existing docs from '${name}'.`);
}

async function main() {
  console.log(`Seeding into project '${projectId}' (emulator ${process.env.FIRESTORE_EMULATOR_HOST})...`);

  // Fresh start so the test is repeatable.
  await clearCollection('users');
  await clearCollection('candidates');

  // 1. Legacy users: 36-char UUID document IDs.
  const legacyUids = Array.from({ length: NUM_USERS }, () => crypto.randomUUID());
  for (let i = 0; i < legacyUids.length; i += CHUNK) {
    const batch = db.batch();
    legacyUids.slice(i, i + CHUNK).forEach((uid, j) => {
      const idx = i + j;
      batch.set(db.collection('users').doc(uid), {
        email: `testuser_${idx}@presift.test`,
        name: `Test User ${idx}`,
        company: `Test Corp ${idx}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  console.log(`  Created ${NUM_USERS} legacy user docs (36-char UUID ids).`);

  // 2. Candidates: all assigned to ONE legacy user to cross the 500-write limit.
  const targetUid = legacyUids[0];
  for (let i = 0; i < NUM_CANDIDATES; i += CHUNK) {
    const batch = db.batch();
    const end = Math.min(i + CHUNK, NUM_CANDIDATES);
    for (let idx = i; idx < end; idx++) {
      batch.set(db.collection('candidates').doc(), {
        recruiterId: targetUid,
        name: `Candidate ${idx}`,
        email: `candidate_${idx}@presift.test`,
      });
    }
    await batch.commit();
  }
  console.log(`  Created ${NUM_CANDIDATES} candidate docs, all recruiterId -> ${targetUid}`);

  console.log('\nSeed complete.');
  console.log(`TARGET_LEGACY_UID=${targetUid}`);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
