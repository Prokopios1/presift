import admin from 'firebase-admin';
import crypto from 'crypto';

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

async function migrate() {
  console.log("Starting Auth Migration...");
  
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users. Processing...`);
  
  for (const doc of usersSnapshot.docs) {
    const userData = doc.data();
    const oldUid = doc.id;
    
    // UUIDs have hyphens, Auth UIDs generally don't (except imported or custom, but typically 28 chars alphanumeric).
    // Local-storage IDs in this system are UUIDs (length 36).
    if (oldUid.length !== 36) {
      console.log(`Skipping ${oldUid} (does not look like a local storage UUID)`);
      continue;
    }
    
    const email = userData.email;
    if (!email) {
      console.warn(`User ${oldUid} has no email, skipping.`);
      continue;
    }
    
    // Generate secure password
    const password = crypto.randomBytes(16).toString('hex');
    
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        displayName: userData.name || '',
      });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        userRecord = await auth.getUserByEmail(email);
        console.log(`User for ${email} already exists in Auth. Using existing UID.`);
      } else {
        console.error(`Error creating auth user for ${email}:`, error);
        continue;
      }
    }
    
    const newUid = userRecord.uid;
    console.log(`MAPPING: ${email} -> ${password} -> ${newUid}`);
    
    // Find all related documents
    const candidatesSnapshot = await db.collection('candidates').where('recruiterId', '==', oldUid).get();
    const campaignsSnapshot = await db.collection('campaigns').where('recruiterId', '==', oldUid).get();
    const sessionsSnapshot = await db.collection('sessions').where('candidateRecruiterId', '==', oldUid).get();
    
    // Firestore batch limits are 500. We assume the total docs per recruiter is < 500.
    // If larger, this script would need chunking.
    const batch = db.batch();
    
    // 1. Set new user doc
    batch.set(db.collection('users').doc(newUid), userData);
    
    // 2. Update relational fields
    candidatesSnapshot.docs.forEach(c => batch.update(c.ref, { recruiterId: newUid }));
    campaignsSnapshot.docs.forEach(c => batch.update(c.ref, { recruiterId: newUid }));
    sessionsSnapshot.docs.forEach(s => batch.update(s.ref, { candidateRecruiterId: newUid }));
    
    // 3. Delete old user doc
    batch.delete(doc.ref);
    
    await batch.commit();
    console.log(`Migrated user ${email}. Updated ${candidatesSnapshot.size} candidates, ${campaignsSnapshot.size} campaigns, ${sessionsSnapshot.size} sessions.`);
  }
  
  console.log("Migration complete.");
}

migrate().catch(console.error);
