import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence } from "firebase/auth";

// Live Firebase project config (project: presift)
const firebaseConfig = {
  apiKey: "AIzaSyBN3-zIWEWgUCSUd8fhSEf2bpgNB8mgNNU",
  authDomain: "presift.firebaseapp.com",
  projectId: "presift",
  appId: "1:924674049393:web:bcb5933e32900de47d62d0",
  storageBucket: "presift.firebasestorage.app",
  messagingSenderId: "924674049393",
};

export const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence);

// Connect to local emulator during development and tests only
if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
}
