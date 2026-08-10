import { describe, it, expect } from 'vitest';
import { validateSubmission, candidateDocId } from '../submission';
import { bank } from '../data/presift-bank';

const ICAR_IDS = bank.cognitive.items.map((i) => i.id);
const WLEIS_IDS = bank.wleis.items.map((i) => i.id);

const validPayload = () => ({
  sessionId: 'sess_abc123',
  icar: ICAR_IDS.map((itemId, i) => ({ itemId, selectedIndex: i % 4 })),
  wleis: WLEIS_IDS.map((itemId, i) => ({ itemId, value: (i % 7) + 1 })),
});

describe('validateSubmission strict (iteration 5)', () => {
  it('rejects payloads carrying difficulty', () => {
    // Arrange
    const payload = validPayload();
    (payload.icar[0] as any).difficulty = 0.72;
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow(/key|forbidden/i);
  });

  it('rejects payloads carrying parameterization', () => {
    // Arrange
    const payload = validPayload();
    (payload.wleis[0] as any).parameterization = {};
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow(/key|forbidden/i);
  });

  it('returns a normalized object containing ONLY sessionId, icar, wleis', () => {
    // Arrange
    const payload = validPayload() as Record<string, unknown>;
    payload.extra = 'sneaky';
    // Act
    const result = validateSubmission(payload, bank);
    // Assert
    expect(Object.keys(result).sort()).toEqual(['icar', 'sessionId', 'wleis']);
  });
});

describe('candidateDocId', () => {
  it('derives the candidate doc id from the session id (never the assessment id)', () => {
    // Arrange
    const sessionId = 'assess_1_sess_abc123';
    // Act
    const docId = candidateDocId(sessionId);
    // Assert
    expect(docId).toBe('cand_' + sessionId);
  });

  it('throws on empty session id', () => {
    // Act / Assert
    expect(() => candidateDocId('')).toThrow();
  });
});
