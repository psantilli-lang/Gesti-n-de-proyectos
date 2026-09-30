import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { app, auth } from './firebase';
export { auth };

// Workspace OAuth Scopes
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;

const SESSION_TOKEN_KEY = 'google_workspace_access_token';
const SESSION_USER_KEY = 'google_workspace_user_email';

// Cache the access token in memory and sessionStorage
let cachedAccessToken: string | null = (() => {
  try {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored && stored.length > 20 && stored !== 'undefined' && stored !== 'null') {
      return stored;
    }
  } catch {
    return null;
  }
  return null;
})();

let currentUserProfile: User | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    currentUserProfile = user;
    const token = getAccessToken();
    if (user && token) {
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else if (!isSigningIn && !token) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso OAuth de Google.');
    }

    cachedAccessToken = credential.accessToken;
    currentUserProfile = result.user;
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, credential.accessToken);
      if (result.user.email) {
        sessionStorage.setItem(SESSION_USER_KEY, result.user.email);
      }
    } catch (e) {
      console.warn('Could not save token to sessionStorage', e);
    }

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const clearStoredToken = (): void => {
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem('google_workspace_access_token');
    localStorage.removeItem('google_workspace_user_email');
  } catch {}
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken && cachedAccessToken.length > 20 && cachedAccessToken !== 'undefined' && cachedAccessToken !== 'null') {
    return cachedAccessToken;
  }
  try {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored && stored.length > 20 && stored !== 'undefined' && stored !== 'null') {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

/**
 * Validates with Google tokeninfo endpoint if the token is still active and has time remaining.
 */
export const validateGoogleToken = async (token: string | null): Promise<boolean> => {
  if (!token || token.length < 20 || token === 'undefined' || token === 'null') {
    return false;
  }
  try {
    const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      return typeof data.expires_in === 'number' && data.expires_in > 30;
    }
    return false;
  } catch {
    return false;
  }
};

export const getCurrentGoogleUser = (): { email: string | null; displayName: string | null } | null => {
  if (currentUserProfile) return { email: currentUserProfile.email, displayName: currentUserProfile.displayName };
  if (auth.currentUser) return { email: auth.currentUser.email, displayName: auth.currentUser.displayName };
  try {
    const savedEmail = sessionStorage.getItem(SESSION_USER_KEY);
    if (savedEmail) {
      return { email: savedEmail, displayName: null };
    }
  } catch {}
  return null;
};

export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  clearStoredToken();
  currentUserProfile = null;
};
