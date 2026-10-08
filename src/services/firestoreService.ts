import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
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
          // Never clear localStorage when Firestore is empty; preserve local projects and back them up to Firestore
          const local = storageService.getProjects();
          if (local && local.length > 0) {
            onData(local);
            firestoreService.replaceAllProjects(local).catch((syncErr) => {
              console.warn('Syncing local projects to Firestore notice:', syncErr);
            });
            return;
          }
          onData([]);
          return;
        }

        const list: SAPProject[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SAPProject;
          list.push({ ...data, id: docSnap.id });
        });

        // Sort projects by priority or code
        list.sort((a, b) => {
          if (a.priority !== undefined && b.priority !== undefined && a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.code.localeCompare(b.code, undefined, { numeric: true });
        });

        // Save to local storage as local cache
        storageService.saveProjects(list);
        onData(list);
      },
      (error) => {
        if ((error as any)?.code === 'unavailable') {
          // Client is in offline mode or reconnecting; local cache continues to serve data
          return;
        }
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
   * No-op: Test projects removed. Official projects are loaded from Google Sheets / CSV.
   */
  async seedInitialProjectsIfEmpty(): Promise<void> {
    // Intentionally empty to prevent re-seeding test data
  },

  /**
   * Completely wipe all projects from Firestore and local storage.
   */
  async deleteAllProjects(): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'projects'));
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      storageService.clearAllProjects();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects');
    }
  },

  /**
   * Replaces all existing projects in Firestore with a new set of projects.
   * Deletes all previous/old projects first, ensuring clean state.
   */
  async replaceAllProjects(newProjects: SAPProject[]): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const snap = await getDocs(collection(db, 'projects'));
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      newProjects.forEach((p) => {
        const docRef = doc(db, 'projects', p.id);
        batch.set(docRef, p);
      });
      await batch.commit();
      storageService.saveProjects(newProjects);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects');
    }
  },

  /**
   * Save or update a single project in Firestore with rock-solid conflict resolution.
   * Guarantees that assigned actions, team members, and comments can NEVER be overwritten
   * or wiped out by a client with stale state or partial updates (e.g. changing status, priority or dates).
   */
  async saveProject(project: SAPProject): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const docRef = doc(db, 'projects', project.id);
      
      let projectToSave = { ...project };
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data() as SAPProject;

          // 1. SMART ACTION MERGE: NEVER lose assigned responsibles, comments, or progress
          if (remoteData.actions && remoteData.actions.length > 0) {
            const localActionMap = new Map((projectToSave.actions || []).map((a) => [a.id, a]));

            remoteData.actions.forEach((remoteAct) => {
              const localAct = localActionMap.get(remoteAct.id);
              if (!localAct) {
                // If remote action was added elsewhere, preserve it!
                localActionMap.set(remoteAct.id, remoteAct);
              } else {
                // Merging existing action:
                const mergedAct = { ...localAct };

                // A. RESPONSIBLE PROTECTION:
                // An already assigned person on the remote database can NEVER be replaced
                // by "Sin asignar" unless the local action explicitly marked `explicitlyUnassigned === true`.
                const remoteIsAssigned =
                  remoteAct.responsible &&
                  remoteAct.responsible.trim() !== '' &&
                  remoteAct.responsible.trim().toLowerCase() !== 'sin asignar' &&
                  remoteAct.responsible.trim().toLowerCase() !== 'sin asignar.';

                const localIsUnassigned =
                  !localAct.responsible ||
                  localAct.responsible.trim() === '' ||
                  localAct.responsible.trim().toLowerCase() === 'sin asignar' ||
                  localAct.responsible.trim().toLowerCase() === 'sin asignar.';

                if (remoteIsAssigned && localIsUnassigned && !localAct.explicitlyUnassigned) {
                  // Keep remote assigned person!
                  mergedAct.responsible = remoteAct.responsible;
                }

                // B. STATUS PROTECTION:
                // If remote action was marked Finalizada or En proceso, don't revert to Pendiente
                // unless local update has a newer updatedAt timestamp.
                const localTimestamp = localAct.updatedAt || localAct.createdAt || '';
                const remoteTimestamp = remoteAct.updatedAt || remoteAct.createdAt || '';
                if (localTimestamp && remoteTimestamp && localTimestamp < remoteTimestamp) {
                  // Remote is newer, prefer remote status and responsible
                  mergedAct.status = remoteAct.status;
                  mergedAct.responsible = remoteAct.responsible;
                  mergedAct.completedAt = remoteAct.completedAt || mergedAct.completedAt;
                } else if (remoteAct.status === 'Finalizada' && localAct.status !== 'Finalizada' && !localAct.updatedAt) {
                  mergedAct.status = remoteAct.status;
                  mergedAct.completedAt = remoteAct.completedAt || mergedAct.completedAt;
                }

                // C. COMMENTS & ATTACHMENTS PROTECTION:
                if ((remoteAct.commentsHistory?.length || 0) > (localAct.commentsHistory?.length || 0)) {
                  mergedAct.commentsHistory = remoteAct.commentsHistory;
                }
                if ((remoteAct.attachments?.length || 0) > (localAct.attachments?.length || 0)) {
                  mergedAct.attachments = remoteAct.attachments;
                }
                if (remoteAct.executionComment && !localAct.executionComment) {
                  mergedAct.executionComment = remoteAct.executionComment;
                }

                localActionMap.set(remoteAct.id, mergedAct);
              }
            });
            projectToSave.actions = Array.from(localActionMap.values());
          }

          // 2. TEAM MEMBERS PROTECTION:
          // If remote had team members and local is empty (e.g. from a quick status change), preserve team
          if (remoteData.team && remoteData.team.length > 0 && (!projectToSave.team || projectToSave.team.length === 0)) {
            projectToSave.team = remoteData.team;
          }
        }
      } catch (checkErr) {
        console.warn('Action merge safety note:', checkErr);
      }

      const cleanProject = JSON.parse(JSON.stringify(projectToSave));
      await setDoc(docRef, cleanProject, { merge: true });
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
        batch.set(docRef, JSON.parse(JSON.stringify(p)));
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

        const remoteList: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AppUser;
          remoteList.push({ ...data, id: docSnap.id });
        });

        // Remote collection in Firestore is authoritative for existing users; preserve local passwords
        const localUsers = storageService.getUsers();
        const localPasswordMap = new Map<string, string>();
        localUsers.forEach((u) => {
          if (u.password) localPasswordMap.set(u.id, u.password);
        });

        const updatedList: AppUser[] = remoteList.map((r) => ({
          ...r,
          password: r.password || localPasswordMap.get(r.id) || (r.username === 'admin' ? 'admin' : r.username === 'pmo' ? 'pmo' : '123'),
        }));

        storageService.saveUsers(updatedList);
        onData(updatedList);
      },
      (error) => {
        if ((error as any)?.code === 'unavailable') {
          // Client is in offline mode or reconnecting; local cache continues to serve data
          return;
        }
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
   * Delete a user in Firestore (direct doc and query cleanup)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const cleanId = userId.trim();
      const docRef = doc(db, 'users', cleanId);
      await deleteDoc(docRef);

      // Clean any documents matching this userId or username
      const snap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let found = false;
      snap.forEach((d) => {
        const data = d.data();
        const dId = d.id.toLowerCase();
        const docUserId = data.id ? String(data.id).toLowerCase() : '';
        const docUsername = data.username ? String(data.username).toLowerCase() : '';
        const targetLower = cleanId.toLowerCase();

        if (dId === targetLower || docUserId === targetLower || docUsername === targetLower) {
          batch.delete(d.ref);
          found = true;
        }
      });
      if (found) {
        await batch.commit();
      }
    } catch (error) {
      console.warn('Firestore delete user warning:', error);
    }
  },

  /**
   * Delete multiple users in Firestore in a batch
   */
  async deleteUsers(userIds: string[]): Promise<void> {
    try {
      await ensureFirebaseAuth();
      const lowerIds = userIds.map((id) => id.trim().toLowerCase());
      const snap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;

      snap.forEach((d) => {
        const data = d.data();
        const dId = d.id.toLowerCase();
        const docUserId = data.id ? String(data.id).toLowerCase() : '';
        const docUsername = data.username ? String(data.username).toLowerCase() : '';

        if (lowerIds.includes(dId) || lowerIds.includes(docUserId) || lowerIds.includes(docUsername)) {
          batch.delete(d.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.warn('Firestore bulk delete users warning:', error);
    }
  },
};
