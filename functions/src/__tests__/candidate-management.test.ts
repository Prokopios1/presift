import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock, updateMock, deleteMock, batchDeleteMock, batchCommitMock, getAllMock } = vi.hoisted(() => {
  return {
    getMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    batchDeleteMock: vi.fn(),
    batchCommitMock: vi.fn(),
    getAllMock: vi.fn()
  };
});

vi.mock('firebase-admin', () => {
  const docMock = vi.fn(() => ({ get: getMock, update: updateMock, delete: deleteMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  const batchMock = vi.fn(() => ({ delete: batchDeleteMock, commit: batchCommitMock }));
  const firestoreMock = () => ({ collection: collectionMock, getAll: getAllMock, batch: batchMock });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {
    })
  };
});

// Minimal mock for firebase-functions to allow callables to be tested
vi.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    https: {
      onCall: (handler: any) => handler, // just pass the handler through so we can call it directly
      onRequest: (handler: any) => handler,
      HttpsError
    },
    pubsub: {
      schedule: () => ({ onRun: (handler: any) => handler })
    },
    config: () => ({ demo: { allow_anon: 'true' } }) // allow bypass
  };
});

import { updateCandidate, bulkDeleteCandidates } from '../index';

describe('Candidate Management Callables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateCandidate', () => {
    it('updates candidate with valid fields', async () => {
      // Arrange
      getMock.mockResolvedValueOnce({ exists: true });
      const data = { candidateId: '123', name: ' John ', email: ' john@example.com ', appliedRole: ' Dev ' };
      
      // Act
      const result = await updateCandidate(data, { auth: { uid: 'recruiter' } } as any);
      
      // Assert
      expect(result).toEqual({ success: true });
      expect(updateMock).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@example.com',
        appliedRole: 'Dev'
      });
    });

    it('rejects empty strings for fields', async () => {
      // Arrange
      const data = { candidateId: '123', name: '   ' }; // empty after trim
      
      // Act / Assert
      await expect(updateCandidate(data, { auth: { uid: 'recruiter' } } as any)).rejects.toThrow('Name cannot be empty');
    });

    it('throws not-found when doc is missing', async () => {
      // Arrange
      getMock.mockResolvedValueOnce({ exists: false });
      const data = { candidateId: '123', name: 'John' };
      
      // Act / Assert
      await expect(updateCandidate(data, { auth: { uid: 'recruiter' } } as any)).rejects.toThrow('Candidate not found');
    });
  });

  describe('bulkDeleteCandidates', () => {
    it('validates array constraints', async () => {
      // Arrange
      const emptyData = { candidateIds: [] };
      const invalidData = { candidateIds: [''] };
      
      // Act / Assert
      await expect(bulkDeleteCandidates(emptyData, { auth: { uid: 'r' } } as any)).rejects.toThrow('candidateIds must be an array of length 1-100');
      await expect(bulkDeleteCandidates(invalidData, { auth: { uid: 'r' } } as any)).rejects.toThrow('Invalid candidate ID in array');
    });

    it('rejects duplicate candidate IDs', async () => {
      // Arrange
      const dupeData = { candidateIds: ['id1', 'id1'] };

      // Act / Assert
      await expect(bulkDeleteCandidates(dupeData, { auth: { uid: 'r' } } as any)).rejects.toThrow('Duplicate candidate IDs not allowed');
    });

    it('processes mixed existing and missing ids', async () => {
      // Arrange
      const data = { candidateIds: ['id1', 'id2'] };
      // getAll returns an array of doc snapshots corresponding to the passed refs
      getAllMock.mockResolvedValueOnce([{ exists: true }, { exists: false }]);
      
      // Act
      const result = await bulkDeleteCandidates(data, { auth: { uid: 'r' } } as any);
      
      // Assert
      expect(result).toEqual({ deleted: 1, missing: ['id2'] });
      expect(batchDeleteMock).toHaveBeenCalledTimes(1); // Only for 'id1'
      expect(batchCommitMock).toHaveBeenCalledTimes(1);
    });
  });
});
