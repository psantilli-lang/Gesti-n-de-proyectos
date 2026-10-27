import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuth } from './firebase';
import { AttachedFile, SAPProject, StageAction } from '../types/project';

// In-memory cache for fast, zero-latency previews within the browser session
const attachmentMemoryCache = new Map<string, string>();

const CHUNK_SIZE = 400 * 1024; // 400 KB per chunk (well below Firestore 1MB limit)

export const attachmentService = {
  /**
   * Caches a file's dataUrl in memory for instant local access.
   */
  cacheLocally(fileId: string, dataUrl: string): void {
    if (fileId && dataUrl) {
      attachmentMemoryCache.set(fileId, dataUrl);
    }
  },

  /**
   * Gets cached dataUrl if already loaded in this session.
   */
  getCachedDataUrl(fileId: string): string | null {
    return attachmentMemoryCache.get(fileId) || null;
  },

  /**
   * Saves an attached file into the dedicated Firestore 'attachments' collection,
   * chunking large files (> 400 KB) into subdocuments if needed.
   * This completely prevents the parent SAPProject document from exceeding Firestore's 1MB limit.
   */
  async saveAttachment(file: AttachedFile): Promise<void> {
    if (!file || !file.id || !file.dataUrl) return;

    // Cache locally immediately
    attachmentMemoryCache.set(file.id, file.dataUrl);

    try {
      await ensureFirebaseAuth();
      const attRef = doc(db, 'attachments', file.id);

      const dataUrl = file.dataUrl;
      const isLarge = dataUrl.length > CHUNK_SIZE;

      if (!isLarge) {
        // Direct storage in single attachment document
        await setDoc(
          attRef,
          {
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            uploadedAt: file.uploadedAt || new Date().toISOString().split('T')[0],
            dataUrl,
            chunked: false,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        // Chunked storage across subdocuments to support large PDFs, Word docs, Excel files
        const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);

        await setDoc(
          attRef,
          {
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            uploadedAt: file.uploadedAt || new Date().toISOString().split('T')[0],
            chunked: true,
            chunkCount: totalChunks,
            totalLength: dataUrl.length,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Write each chunk
        for (let i = 0; i < totalChunks; i++) {
          const chunkStr = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkRef = doc(db, 'attachments', file.id, 'chunks', `chunk_${i}`);
          await setDoc(chunkRef, { index: i, chunk: chunkStr });
        }
      }
    } catch (err) {
      console.warn(`Error storing attachment ${file.id} in Firestore:`, err);
    }
  },

  /**
   * Retrieves the full dataUrl for an attachment.
   * Checks local memory cache first, then fetches from Firestore 'attachments' collection.
   */
  async getAttachmentDataUrl(fileId: string): Promise<string | null> {
    if (!fileId) return null;

    // 1. Fast cache check
    if (attachmentMemoryCache.has(fileId)) {
      return attachmentMemoryCache.get(fileId)!;
    }

    try {
      await ensureFirebaseAuth();
      const attRef = doc(db, 'attachments', fileId);
      const snap = await getDoc(attRef);

      if (!snap.exists()) {
        return null;
      }

      const data = snap.data();
      if (!data) return null;

      if (!data.chunked && data.dataUrl) {
        attachmentMemoryCache.set(fileId, data.dataUrl);
        return data.dataUrl;
      }

      if (data.chunked && data.chunkCount) {
        const chunksCol = collection(db, 'attachments', fileId, 'chunks');
        const chunkSnaps = await getDocs(chunksCol);
        const chunks: Array<{ index: number; chunk: string }> = [];

        chunkSnaps.forEach((cd) => {
          const cdata = cd.data() as { index: number; chunk: string };
          chunks.push(cdata);
        });

        chunks.sort((a, b) => a.index - b.index);
        const fullDataUrl = chunks.map((c) => c.chunk).join('');

        if (fullDataUrl) {
          attachmentMemoryCache.set(fileId, fullDataUrl);
          return fullDataUrl;
        }
      }
    } catch (err) {
      console.warn(`Error loading attachment ${fileId} from Firestore:`, err);
    }

    return null;
  },

  /**
   * Strips heavy base64 dataUrls from project files before writing to the 'projects' collection,
   * saving each file's content into the 'attachments' collection first.
   * Keeps projects ultra-light (~5-20 KB instead of 1 MB) so Firestore writes never fail.
   */
  async sanitizeProjectForFirestore(project: SAPProject): Promise<SAPProject> {
    const projectCopy: SAPProject = JSON.parse(JSON.stringify(project));

    // Helper to sanitize an array of files
    const processFiles = async (files?: AttachedFile[]): Promise<AttachedFile[]> => {
      if (!files || files.length === 0) return [];
      const sanitized: AttachedFile[] = [];

      for (const f of files) {
        if (f.dataUrl) {
          // Cache locally and persist to dedicated attachments collection
          attachmentMemoryCache.set(f.id, f.dataUrl);
          await this.saveAttachment(f);
        }

        // Project document only stores metadata:
        sanitized.push({
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          uploadedAt: f.uploadedAt,
          // Intentionally omitting dataUrl from parent document
        });
      }
      return sanitized;
    };

    // 1. Process action attachments
    if (projectCopy.actions && projectCopy.actions.length > 0) {
      for (const act of projectCopy.actions) {
        if (act.attachments && act.attachments.length > 0) {
          act.attachments = await processFiles(act.attachments);
        }
      }
    }

    // 2. Process situation and improvement files
    if (projectCopy.currentSituationFiles && projectCopy.currentSituationFiles.length > 0) {
      projectCopy.currentSituationFiles = await processFiles(projectCopy.currentSituationFiles);
    }
    if (projectCopy.improvementNeedFiles && projectCopy.improvementNeedFiles.length > 0) {
      projectCopy.improvementNeedFiles = await processFiles(projectCopy.improvementNeedFiles);
    }

    return projectCopy;
  },

  /**
   * Enriches project actions with locally cached dataUrls when available,
   * so UI components can display or download them instantly.
   */
  enrichProjectWithCachedAttachments(project: SAPProject): SAPProject {
    if (!project.actions) return project;

    let hasChanges = false;
    const enrichedActions = project.actions.map((act) => {
      if (!act.attachments || act.attachments.length === 0) return act;

      let actChanged = false;
      const enrichedAtts = act.attachments.map((att) => {
        if (!att.dataUrl && attachmentMemoryCache.has(att.id)) {
          actChanged = true;
          return { ...att, dataUrl: attachmentMemoryCache.get(att.id) };
        }
        return att;
      });

      if (actChanged) {
        hasChanges = true;
        return { ...act, attachments: enrichedAtts };
      }
      return act;
    });

    if (hasChanges) {
      return { ...project, actions: enrichedActions };
    }
    return project;
  },
};
