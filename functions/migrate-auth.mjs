import admin from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin (assuming run with GOOGLE_APPLICATION_CREDENTIALS or emulator)
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'b2b-assessment-engine'
});

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log("Running against Firestore Emulator:", process.env.FIRESTORE_EMULATOR_HOST);
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log("Running against Auth Emulator:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

const db = admin.firestore();
const auth = admin.auth();

async function migrateAuth() {
  console.log('Starting migration...');
  
  // 1. Fetch all users from Firestore
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users.`);

  const mappings = [];
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const oldUid = doc.id;
    
    // Skip if already migrated (assuming old UIDs are not standard Firebase Auth UIDs,
    // which are 28 chars long. Or if they already exist in Auth, we can skip.)
    try {
      await auth.getUser(oldUid);
      console.log(`User ${oldUid} already exists in Auth. Skipping.`);
      continue;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        console.error(`Error checking user ${oldUid}:`, error);
        continue;
      }
    }

    if (!userData.email) {
      console.log(`User ${oldUid} has no email. Skipping.`);
      continue;
    }

    const email = userData.email;
    const password = crypto.randomBytes(16).toString('hex');
    
    try {
      console.log(`Creating auth user for ${email}...`);
      const userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: userData.company || userData.name || '',
      });
      
      const newUid = userRecord.uid;
      
      const operations = [];
      
      // 1. Create new user document
      const newUserRef = db.collection('users').doc(newUid);
      operations.push({ ref: newUserRef, type: 'set', data: {
        ...userData,
        migratedFrom: oldUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }});
      
      // 2. Delete old user document
      operations.push({ ref: doc.ref, type: 'delete' });
      
      // 3. Find and update campaigns
      const campaignsSnapshot = await db.collection('campaigns').where('recruiterId', '==', oldUid).get();
      campaignsSnapshot.docs.forEach(campaignDoc => {
        operations.push({ ref: campaignDoc.ref, type: 'update', data: { recruiterId: newUid } });
      });
      
      // 4. Find and update candidates
      const candidatesSnapshot = await db.collection('candidates').where('recruiterId', '==', oldUid).get();
      candidatesSnapshot.docs.forEach(candidateDoc => {
        operations.push({ ref: candidateDoc.ref, type: 'update', data: { recruiterId: newUid } });
      });
      
      // Commit operations in chunks of 499
      const chunkSize = 499;
      for (let i = 0; i < operations.length; i += chunkSize) {
        const chunk = operations.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach(op => {
          if (op.type === 'set') batch.set(op.ref, op.data);
          else if (op.type === 'update') batch.update(op.ref, op.data);
          else if (op.type === 'delete') batch.delete(op.ref);
        });
        await batch.commit();
      }
      
      console.log(`Successfully migrated user ${email} (Old UID: ${oldUid} -> New UID: ${newUid})`);
      mappings.push({
        email,
        password,
        oldUid,
        newUid
      });
      
    } catch (error) {
      console.error(`Failed to migrate user ${oldUid}:`, error);
    }
  }
  
  console.log('\n--- MIGRATION COMPLETE ---');
  console.log('CREDENTIALS MAPPING (STORE SECURELY AND DISTRIBUTE TO USERS):');
  console.table(mappings);
}

migrateAuth().catch(console.error);
