import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as functions from 'firebase-functions';
import { submitAssessment } from '../index';
import { bank } from '../data/presift-bank';
import { resolveSession, buildSessionKeys } from '../session';

const ICAR_IDS = bank.cognitive.items.map((i) => i.id);
const WLEIS_IDS = bank.wleis.items.map((i) => i.id);

const validPayload = () => ({
  sessionId: 'sess_abc123',
  icar: ICAR_IDS.map((itemId, i) => ({ itemId, selectedIndex: i % 4 })),
  wleis: WLEIS_IDS.map((itemId, i) => ({ itemId, value: (i % 5) + 1 })),
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

  it('fails loudly (failed-precondition) if candidates/<assessmentId> is missing and no identity was captured', async () => {
    // Arrange
    const payload = validPayload();
    const assessmentId = 'direct_test_link';

    // Mock session doc — no identity fields (candidate record never existed
    // in this database, e.g. link created in the emulator, completed on prod).
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
    const err: any = await (submitAssessment as any).run(payload, { auth: null }).catch((e: any) => e);

    // Assert — explicit error, NO anonymous orphan doc, session NOT consumed.
    expect(err).toBeInstanceOf(functions.https.HttpsError);
    expect(err.code).toBe('failed-precondition');
    expect(String(err.message)).toMatch(/invalid/i);
    expect(candidateGetMock).toHaveBeenCalled();
    expect(candidateSetMock).not.toHaveBeenCalled();
    expect(sessionDeleteMock).not.toHaveBeenCalled();
  });

  // --- Smile Assessment Integration ---

  it('stores scoreResult.smile block when valid smileAnswers are provided', async () => {
    // Arrange
    const payload = {
      ...validPayload(),
      smileAnswers: bank.smileTask.trials.map((t: any) => ({
        trialId: t.trialId,
        perceived: t.groundTruth,
        rtMs: 500
      }))
    };
    const assessmentId = 'invited_cand_456';
    
    sessionGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        keys: validKeys,
        assessmentId,
        integrityEvents: []
      }),
      ref: { delete: sessionDeleteMock }
    });

    candidateGetMock.mockResolvedValueOnce({
      exists: true
    });

    // Act
    await (submitAssessment as any).run(payload, { auth: null });

    // Assert
    expect(candidateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scoreResult: expect.objectContaining({
          smile: expect.objectContaining({
            score: expect.any(Number),
            total: expect.any(Number),
            accuracy: expect.any(Number),
            calibration: expect.objectContaining({
              calibratedOeaScore: expect.any(Number),
              biasDirection: expect.any(String),
              level: expect.any(String)
            })
          })
        })
      }),
      { merge: true }
    );
  });

  it('stores NO smile block when smileAnswers are NOT provided (backward compat)', async () => {
    // Arrange
    const payload = validPayload(); // no smileAnswers
    const assessmentId = 'invited_cand_456';
    
    sessionGetMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        keys: validKeys,
        assessmentId,
        integrityEvents: []
      }),
      ref: { delete: sessionDeleteMock }
    });

    candidateGetMock.mockResolvedValueOnce({
      exists: true
    });

    // Act
    await (submitAssessment as any).run(payload, { auth: null });

    // Assert
    const callArg = candidateSetMock.mock.calls[candidateSetMock.mock.calls.length - 1][0];
    expect(callArg.scoreResult.smile).toBeUndefined();
  });
});

