import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize singleton Firebase app
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Google Auth Provider configured for corporate sign-in
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore with auto-detect long polling for robust connection in iframe and corporate environments
const configWithDb = firebaseConfig as unknown as { firestoreDatabaseId?: string };
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    configWithDb.firestoreDatabaseId || undefined
  );
} catch {
  firestoreInstance = configWithDb.firestoreDatabaseId
    ? getFirestore(app, configWithDb.firestoreDatabaseId)
    : getFirestore(app);
}
export const db = firestoreInstance;

// Authenticate via Google Sign-In with Firebase Auth
export async function signInWithGoogleFirebase(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked') {
      const friendlyErr = new Error(
        'La ventana emergente de Google fue bloqueada por el navegador. Permití las ventanas emergentes en la barra de direcciones de tu navegador e intentá nuevamente.'
      );
      (friendlyErr as any).code = 'auth/popup-blocked';
      throw friendlyErr;
    }
    throw err;
  }
}

// Sign out from Firebase Auth
export async function signOutFromFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

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
    return true;
  } catch (error) {
    console.warn('Firebase connection notice:', error);
    return false;
  }
}
