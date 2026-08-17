/**
 * One-time backfill: for every candidate doc where `clientIds` is missing or
 * not an array, set clientIds = [recruiterId] (if recruiterId is a non-empty
 * string) or [] (if not).
 *
 * This is idempotent — safe to re-run; docs that already have a proper
 * clientIds array are skipped.
 *
 * Run with: node scripts/backfill-client-ids.mjs
 * DO NOT run against prod data until instructed by Hermes after A1 verification.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Uses Application Default Credentials (gcloud auth application-default login).
// projectId is explicit because without it the SDK infers no project from ADC in this env.
initializeApp({ projectId: 'presift' });

const db = getFirestore();

// Firestore max batch size is 500 writes.
const BATCH_SIZE = 500;

async function backfill() {
  const candidatesSnap = await db.collection('candidates').get();

  if (candidatesSnap.empty) {
    console.log('No candidate docs found — nothing to migrate.');
    console.log('Migrated: 0 / Skipped: 0');
    process.exit(0);
  }

  let migrated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of candidatesSnap.docs) {
    const data = doc.data();

    // Skip if clientIds already exists and is a proper array.
    if (Array.isArray(data.clientIds)) {
      console.log(`  Skipping ${doc.id} — clientIds already set (${data.clientIds.length} entries)`);
      skipped++;
      continue;
    }

    // Determine the value to write.
    const clientIds =
      data.recruiterId && typeof data.recruiterId === 'string'
        ? [data.recruiterId]
        : [];

    console.log(
      `  Migrating ${doc.id} — setting clientIds = [${clientIds.join(', ')}]`
    );

    batch.update(doc.ref, { clientIds });
    migrated++;
    batchCount++;

    // Commit the current batch and start a new one when the limit is reached.
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} writes.`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit any remaining writes.
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} writes.`);
  }

  console.log(`\nMigrated: ${migrated} / Skipped: ${skipped}`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
