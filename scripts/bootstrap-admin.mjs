import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Instruct to run with FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST if local
// e.g.,
// FIRESTORE_EMULATOR_HOST="127.0.0.1:8081" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099" node scripts/bootstrap-admin.mjs

const app = initializeApp({
  projectId: 'b2b-assessment-engine'
});

const auth = getAuth(app);
const db = getFirestore(app);

async function bootstrapAdmin() {
  const email = 'prokopios@presift.app';
  const password = crypto.randomBytes(8).toString('hex') + 'A1!'; // Secure random password
  
  console.log(`Starting bootstrap for admin: ${email}`);

  let authUid;
  try {
    // Try to get existing user
    const existingUser = await auth.getUserByEmail(email);
    console.log(`User already exists in Auth with UID: ${existingUser.uid}`);
    
    // Update password to the new known password
    await auth.updateUser(existingUser.uid, { password });
    console.log(`Updated password for existing user.`);
    authUid = existingUser.uid;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // Create new user
      const newUser = await auth.createUser({
        email,
        password,
        displayName: 'PreSift Admin',
      });
      console.log(`Created new Auth user with UID: ${newUser.uid}`);
      authUid = newUser.uid;
    } else {
      console.error('Error fetching/creating Auth user:', error);
      process.exit(1);
    }
  }

  // Update the Firestore document `users/owner_prokopios`
  try {
    const adminDocRef = db.collection('users').doc('owner_prokopios');
    const docSnap = await adminDocRef.get();
    
    if (docSnap.exists) {
      await adminDocRef.update({ authUid });
      console.log(`Updated Firestore document users/owner_prokopios with authUid: ${authUid}`);
    } else {
      await adminDocRef.set({
        email,
        role: 'admin',
        credits: 999,
        companyName: 'PreSift Admin',
        authUid
      });
      console.log(`Created Firestore document users/owner_prokopios with authUid: ${authUid}`);
    }
  } catch (error) {
    console.error('Error updating Firestore:', error);
    process.exit(1);
  }

  console.log('\n=========================================');
  console.log('✅ Admin Bootstrap Complete');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Auth UID:', authUid);
  console.log('=========================================\n');
  
  console.log('Instructions:');
  console.log('1. Run this script against the emulator for local testing:');
  console.log('   FIRESTORE_EMULATOR_HOST="127.0.0.1:8081" FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099" NODE_PATH="./functions/node_modules" node scripts/bootstrap-admin.mjs');
  console.log('2. Save the password above to log in to the admin dashboard.');
  process.exit(0);
}

bootstrapAdmin();
