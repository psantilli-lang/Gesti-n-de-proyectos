import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize singleton Firebase app
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Firestore with specific database ID if provided
const configWithDb = firebaseConfig as unknown as { firestoreDatabaseId?: string };
export const db = configWithDb.firestoreDatabaseId
  ? getFirestore(app, configWithDb.firestoreDatabaseId)
  : getFirestore(app);

// Ensure authenticated session for Firestore rules
export async function ensureFirebaseAuth(): Promise<void> {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.warn('Anonymous sign-in for Firestore fallback:', err);
    }
  }
}

// Connection validation per guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await ensureFirebaseAuth();
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Verifique la configuración de Firebase: el cliente está fuera de línea.');
    }
    return false;
  }
}

// Automatic connection test on boot
testFirestoreConnection().catch(() => {});
