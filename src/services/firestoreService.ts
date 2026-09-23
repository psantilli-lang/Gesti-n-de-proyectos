import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, ensureFirebaseAuth } from './firebase';
import { SAPProject, AppUser } from '../types/project';
import { storageService } from './storageService';
import { INITIAL_PROJECTS, INITIAL_APP_USERS } from '../data/initialData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operation: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

export function handleFirestoreError(
  error: unknown,
  operation: OperationType,
  path: string | null
): never {
  const err = error as { code?: string; message?: string };
  const currentUser = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: err.message || String(error),
    operation,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
  };
  throw new Error(JSON.stringify(errorInfo));
}

export const firestoreService = {
  /**
   * Real-time subscription to the projects collection.
   */
  subscribeToProjects(
    onData: (projects: SAPProject[]) => void,
    onError?: (err: any) => void
  ): () => void {
    ensureFirebaseAuth().catch(() => {});
    const projectsCol = collection(db, 'projects');

    const unsubscribe = onSnapshot(
      projectsCol,
      (snapshot) => {
        if (snapshot.empty) {
          // If empty in Firestore, seed initial projects
          this.seedInitialProjectsIfEmpty()
            .then(() => {})
            .catch((e) => console.warn('Seeding initial projects in Firestore failed:', e));
          return;
        }

        const list: SAPProject[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SAPProject;
          list.push({ ...data, id: docSnap.id });
        });

        // Sort projects by priority or code
        list.sort((a, b) => {
          if (a.priority !== undefined && b.priority !== undefined) {
            return a.priority - b.priority;
          }
          return a.code.localeCompare(b.code);
        });

        // Save to local storage as local cache
        storageService.saveProjects(list);
        onData(list);
      },
      (error) => {
        console.error('Firestore projects onSnapshot error:', error);
        if (onError) onError(error);
        try {
          handleFirestoreError(error, OperationType.LIST, 'projects');
        } catch (e) {
          // Keep logged for diagnostic
        }
      }
    );

    return unsubscribe;
  },

  /**
   * Seed default projects into Firestore if empty
   */
  async seedInitialProjectsIfEmpty(): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'projects'));
      if (snap.empty) {
        // Read from local storage or INITIAL_PROJECTS
        const currentLocal = storageService.getProjects();
        const toSeed = currentLocal.length > 0 ? currentLocal : INITIAL_PROJECTS;

        const batch = writeBatch(db);
        toSeed.forEach((p) => {
          const docRef = doc(db, 'projects', p.id);
          batch.set(docRef, p);
        });
        await batch.commit();
      }
    } catch (error) {
      console.warn('Error seeding initial projects to Firestore:', error);
    }
  },

  /**
   * Save or update a single project in Firestore
   */
  async saveProject(project: SAPProject): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'projects', project.id);
      await setDoc(docRef, project, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${project.id}`);
    }
  },

  /**
   * Save all projects in bulk (e.g. after re-ordering priorities)
   */
  async saveAllProjects(projects: SAPProject[]): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const batch = writeBatch(db);
      projects.forEach((p) => {
        const docRef = doc(db, 'projects', p.id);
        batch.set(docRef, p);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  },

  /**
   * Delete a project from Firestore
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'projects', projectId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  },

  /**
   * Reset data to defaults directly in Firestore
   */
  async resetToDefaults(): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'projects'));
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      INITIAL_PROJECTS.forEach((p) => {
        const docRef = doc(db, 'projects', p.id);
        batch.set(docRef, p);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  },

  /**
   * Real-time subscription to the users collection.
   */
  subscribeToUsers(
    onData: (users: AppUser[]) => void,
    onError?: (err: any) => void
  ): () => void {
    ensureFirebaseAuth().catch(() => {});
    const usersCol = collection(db, 'users');

    const unsubscribe = onSnapshot(
      usersCol,
      (snapshot) => {
        if (snapshot.empty) {
          this.seedInitialUsersIfEmpty()
            .then(() => {})
            .catch((e) => console.warn('Seeding initial users in Firestore failed:', e));
          return;
        }

        const list: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AppUser;
          list.push({ ...data, id: docSnap.id });
        });

        storageService.saveUsers(list);
        onData(list);
      },
      (error) => {
        console.error('Firestore users onSnapshot error:', error);
        if (onError) onError(error);
        try {
          handleFirestoreError(error, OperationType.LIST, 'users');
        } catch (e) {}
      }
    );

    return unsubscribe;
  },

  /**
   * Seed default users into Firestore if empty
   */
  async seedInitialUsersIfEmpty(): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'users'));
      if (snap.empty) {
        const currentLocal = storageService.getUsers();
        const toSeed = currentLocal.length > 0 ? currentLocal : INITIAL_APP_USERS;

        const batch = writeBatch(db);
        toSeed.forEach((u) => {
          const docRef = doc(db, 'users', u.id);
          batch.set(docRef, u);
        });
        await batch.commit();
      }
    } catch (error) {
      console.warn('Error seeding initial users to Firestore:', error);
    }
  },

  /**
   * Save a user in Firestore
   */
  async saveUser(user: AppUser): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'users', user.id);
      await setDoc(docRef, user, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    }
  },

  /**
   * Delete a user in Firestore
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'users', userId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  },
};
