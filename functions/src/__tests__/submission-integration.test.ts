import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitAssessment } from '../index';
import { bank } from '../data/presift-bank';
import { resolveSession, buildSessionKeys } from '../session';

const ICAR_IDS = bank.cognitive.items.map((i) => i.id);
const WLEIS_IDS = bank.wleis.items.map((i) => i.id);

const validPayload = () => ({
  sessionId: 'sess_abc123',
  icar: ICAR_IDS.map((itemId, i) => ({ itemId, selectedIndex: i % 4 })),
  wleis: WLEIS_IDS.map((itemId, i) => ({ itemId, value: (i % 7) + 1 })),
});

// Mock Firestore
const sessionGetMock = vi.fn();
const sessionDeleteMock = vi.fn();
const candidateGetMock = vi.fn();
const candidateSetMock = vi.fn();

vi.mock('firebase-admin/firestore', () => {
  return {
    FieldValue: {
      serverTimestamp: vi.fn(() => 'TIMESTAMP'),
      increment: vi.fn((n) => `INCREMENT_${n}`)
    }
  };
});

vi.mock('firebase-admin', () => {
  const _docMock = vi.fn((_path) => {
    return { get: vi.fn(), set: vi.fn(), ref: { delete: vi.fn() } };
  });
  
  const collectionMock = vi.fn((coll) => {
    return {
      doc: vi.fn((_docId) => {
        if (coll === 'sessions') {
          return { get: sessionGetMock, ref: { delete: sessionDeleteMock } };
        } else if (coll === 'candidates') {
          return { get: candidateGetMock, set: candidateSetMock };
        }
        return { get: vi.fn(), set: vi.fn() };
      })
    };
  });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: () => ({ collection: collectionMock })
  };
});

describe('submitAssessment integration', () => {
  let validKeys: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const session = resolveSession('fake_id', bank, () => 0);
    validKeys = buildSessionKeys(session, bank, () => 0);
  });

  it('merges into invited doc if candidates/<assessmentId> exists', async () => {
    // Arrange
    const payload = validPayload();
    const assessmentId = 'invited_cand_456';
    
    // Mock session doc
    sessionGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        keys: validKeys,
        assessmentId,
        integrityEvents: []
      }),
      ref: { delete: sessionDeleteMock }
    });

    // Mock candidate doc (exists)
    candidateGetMock.mockResolvedValueOnce({
      exists: true
    });

    // Act
    await (submitAssessment as any).run(payload, { auth: null });

    // Assert
    expect(sessionGetMock).toHaveBeenCalled();
    expect(candidateGetMock).toHaveBeenCalled();
    expect(candidateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'Completed',
        scoreResult: expect.any(Object),
        fitBadge: expect.any(String),
        completedAt: 'TIMESTAMP',
      }),
      { merge: true }
    );
    expect(sessionDeleteMock).toHaveBeenCalled();
  });

  it('falls back to cand_<sessionId> if candidates/<assessmentId> is missing', async () => {
    // Arrange
    const payload = validPayload();
    const assessmentId = 'direct_test_link';
    
    // Mock session doc
    sessionGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        keys: validKeys,
        assessmentId,
        integrityEvents: []
      }),
      ref: { delete: sessionDeleteMock }
    });

    // Mock candidate doc (missing)
    candidateGetMock.mockResolvedValueOnce({
      exists: false
    });

    // Act
    await (submitAssessment as any).run(payload, { auth: null });

    // Assert
    expect(candidateGetMock).toHaveBeenCalled();
    expect(candidateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'direct_test_link',
        status: 'Completed',
      }),
      { merge: true }
    );
    expect(sessionDeleteMock).toHaveBeenCalled();
  });
});

