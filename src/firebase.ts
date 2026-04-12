import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence, doc, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

console.log("Initializing Firebase with Project ID:", firebaseConfig.projectId);

if (!firebaseConfig || !firebaseConfig.projectId) {
  console.error("Firebase configuration is missing or invalid. Please check firebase-applet-config.json.");
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)" 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

// Use initializeFirestore with long polling for better reliability in proxy environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore persistence failed: Browser not supported.");
    }
  });
}

export const auth = getAuth(app);

// Set persistence to ensure login "sticks"
setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log("Auth persistence set to browserSessionPersistence");
  })
  .catch((error) => {
    console.error("Error setting auth persistence:", error);
  });

// Diagnostic Mode
if (typeof window !== 'undefined') {
  (window as any).firebaseDebug = auth;
}

// Connection test
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test completed (document may not exist, but connection is alive)");
  } catch (error) {
    console.error("Firestore connection test error:", error);
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firebase client is offline. Check configuration and network.");
    }
  }
}
testConnection();
