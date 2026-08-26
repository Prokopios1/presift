/**
 * Tests for archiveCandidate callable and the startSession archived gate.
 * AAA layout with // Arrange / // Act / // Assert comment zones.
 * Follows the existing pattern in admin-clients.test.ts and submission-identity.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any imports that need them
// ---------------------------------------------------------------------------
const {
  getMock,
  updateMock,
  setMock,
  collectionMock,
  docMock,
  holder,
} = vi.hoisted(() => {
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock, update: updateMock, set: setMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  // Holder for per-test fake Firestore (used by startSession integration tests)
  const holder: { fs: any } = { fs: null };

  return { getMock, updateMock, setMock, collectionMock, docMock, holder };
});

vi.mock('firebase-admin', () => {
  const firestoreMock = () => holder.fs ?? { collection: collectionMock };
  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {}),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    delete: () => '__DELETE__',
    increment: (n: number) => `__INCREMENT_${n}__`,
  },
}));

vi.mock('firebase-functions', () => {
  class HttpsError extends Error {
    public code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    https: {
      onCall: (handler: any) => handler,
      onRequest: (handler: any) => handler,
      HttpsError,
    },
    pubsub: {
      schedule: () => ({ onRun: (handler: any) => handler }),
    },
    config: () => ({ demo: { allow_anon: 'true' } }),
  };
});

import { archiveCandidate, startSession } from '../index';

const AUTH_CTX = { auth: { uid: 'recruiter_uid' } } as any;
const ANON_CTX = { auth: undefined } as any;

// ---------------------------------------------------------------------------
// Helpers — fake Firestore for startSession integration tests
// ---------------------------------------------------------------------------
type DocData = Record<string, any>;

function createFakeFirestore(
  initial: Record<string, Record<string, DocData>> = {}
) {
  const store = new Map<string, DocData>();
  for (const [coll, docs] of Object.entries(initial)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${coll}/${id}`, structuredClone(data));
    }
  }
  const makeRef = (coll: string, id: string) => {
    const key = `${coll}/${id}`;
    return {
      get: async () => ({
        exists: store.has(key),
        data: () => (store.has(key) ? structuredClone(store.get(key)) : undefined),
        ref: { delete: async () => { store.delete(key); } },
      }),
      set: async (data: DocData, opts?: { merge?: boolean }) => {
        if (opts?.merge && store.has(key)) store.set(key, { ...store.get(key), ...data });
        else store.set(key, structuredClone(data));
      },
      update: async (data: DocData) => {
        if (!store.has(key)) throw new Error(`No document to update: ${key}`);
        store.set(key, { ...store.get(key), ...data });
      },
      delete: async () => { store.delete(key); },
    };
  };
  return {
    _store: store,
    collection: (coll: string) => ({ doc: (id: string) => makeRef(coll, id) }),
  };
}

// ---------------------------------------------------------------------------
// archiveCandidate
// ---------------------------------------------------------------------------
describe('archiveCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.fs = null; // use simple collectionMock for these unit tests
    updateMock.mockResolvedValue(undefined);
  });

  it('happy path: archived true — sets archived flag and archivedAt', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({ exists: true });
    const data = { candidateId: 'cand_001', archived: true };

    // Act
    const result = await archiveCandidate(data, AUTH_CTX);

    // Assert
    expect(updateMock).toHaveBeenCalledWith({
      archived: true,
      archivedAt: '__SERVER_TIMESTAMP__',
    });
    expect(result).toEqual({ candidateId: 'cand_001', archived: true });
    // Must NOT touch status, recruiterId, clientIds, scores, sessions, or results
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('status');
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('recruiterId');
    expect(updateMock.mock.calls[0][0]).not.toHaveProperty('clientIds');
  });

  it('happy path: archived false (unarchive) — clears archived flag and deletes archivedAt', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({ exists: true });
    const data = { candidateId: 'cand_001', archived: false };

    // Act
    const result = await archiveCandidate(data, AUTH_CTX);

    // Assert
    expect(updateMock).toHaveBeenCalledWith({
      archived: false,
      archivedAt: '__DELETE__',
    });
    expect(result).toEqual({ candidateId: 'cand_001', archived: false });
  });

  it('throws invalid-argument when archived is not boolean (string "true")', async () => {
    // Arrange
    const data = { candidateId: 'cand_001', archived: 'true' };

    // Act
    const act = archiveCandidate(data, AUTH_CTX);

    // Assert
    await expect(act).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toThrow('archived must be a boolean');
  });

  it('throws invalid-argument when archived is not boolean (number 1)', async () => {
    // Arrange
    const data = { candidateId: 'cand_001', archived: 1 };

    // Act / Assert
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when archived is omitted (undefined)', async () => {
    // Arrange
    const data = { candidateId: 'cand_001' };

    // Act / Assert
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws invalid-argument when candidateId is missing', async () => {
    // Arrange
    const data = { archived: true };

    // Act / Assert
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toThrow('candidateId must be a non-empty string');
  });

  it('throws not-found when candidate doc does not exist', async () => {
    // Arrange
    getMock
      .mockResolvedValueOnce({ exists: false }) // first call
      .mockResolvedValueOnce({ exists: false }); // second call
    const data = { candidateId: 'ghost_cand', archived: true };

    // Act / Assert
    await expect(archiveCandidate(data, AUTH_CTX)).rejects.toMatchObject({ code: 'not-found' });
    await expect(archiveCandidate({ candidateId: 'ghost_cand', archived: true }, AUTH_CTX)).rejects.toThrow('Candidate not found');
  });

  it('demo-mode: anonymous caller accepted when allow_anon is true', async () => {
    // Arrange — config mock returns allow_anon:'true', so ANON_CTX is accepted via demo bypass
    getMock.mockResolvedValueOnce({ exists: true });
    const data = { candidateId: 'cand_001', archived: true };

    // Act / Assert — should resolve, not throw unauthenticated
    await expect(archiveCandidate(data, ANON_CTX)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// startSession — archived gate
// ---------------------------------------------------------------------------
describe('startSession — archived gate', () => {
  beforeEach(() => {
    holder.fs = createFakeFirestore();
  });

  it('throws failed-precondition and creates NO session doc when candidate is archived', async () => {
    // Arrange
    const assessmentId = 'cand_archived_001';
    holder.fs = createFakeFirestore({
      candidates: {
        [assessmentId]: {
          name: 'Archived Person',
          email: 'archived@example.com',
          appliedRole: 'Engineer',
          recruiterId: 'recruiter_uid',
          status: 'Invited',
          archived: true,
          archivedAt: '__SERVER_TIMESTAMP__',
        },
      },
    });

    // Act
    const act = (startSession as any)({ assessmentId }, AUTH_CTX);

    // Assert
    await expect(act).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      (startSession as any)({ assessmentId }, AUTH_CTX)
    ).rejects.toThrow('This candidate is archived and cannot start a new assessment session.');

    // No session doc must have been created
    const sessionKeys = [...holder.fs._store.keys()].filter((k: string) => k.startsWith('sessions/'));
    expect(sessionKeys).toHaveLength(0);
  });

  it('starts normally and creates a session doc when candidate is NOT archived', async () => {
    // Arrange
    const assessmentId = 'cand_active_001';
    holder.fs = createFakeFirestore({
      candidates: {
        [assessmentId]: {
          name: 'Active Person',
          email: 'active@example.com',
          appliedRole: 'Designer',
          recruiterId: 'recruiter_uid',
          status: 'Invited',
          archived: false,
        },
      },
    });

    // Act
    const result: any = await (startSession as any)({ assessmentId }, AUTH_CTX);

    // Assert — session started successfully
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('items');
    expect(result.keys).toBeUndefined(); // keys must never be returned to client

    // Session doc must exist in store
    const sessionKeys = [...holder.fs._store.keys()].filter((k: string) => k.startsWith('sessions/'));
    expect(sessionKeys).toHaveLength(1);

    const sessionDoc = holder.fs._store.get(sessionKeys[0]);
    expect(sessionDoc).toBeTruthy();
    expect(sessionDoc.candidateName).toBe('Active Person');
    expect(sessionDoc.candidateEmail).toBe('active@example.com');
  });

  it('starts normally when archived field is absent (undefined is not === true)', async () => {
    // Arrange — candidate doc has no archived field at all
    const assessmentId = 'cand_no_archive_field';
    holder.fs = createFakeFirestore({
      candidates: {
        [assessmentId]: {
          name: 'Plain Person',
          email: 'plain@example.com',
          appliedRole: 'PM',
          recruiterId: 'recruiter_uid',
          status: 'Invited',
          // archived field deliberately absent
        },
      },
    });

    // Act
    const result: any = await (startSession as any)({ assessmentId }, AUTH_CTX);

    // Assert
    expect(result).toHaveProperty('sessionId');
    const sessionKeys = [...holder.fs._store.keys()].filter((k: string) => k.startsWith('sessions/'));
    expect(sessionKeys).toHaveLength(1);
  });
});
