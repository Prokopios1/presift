import { describe, it, expect } from 'vitest';
import { validateSubmission } from '../submission';
import { bank } from '../data/presift-bank';

const ICAR_IDS = bank.cognitive.items.map((i) => i.id);
const WLEIS_IDS = bank.wleis.items.map((i) => i.id);

const validPayload = () => ({
  sessionId: 'sess_abc123',
  icar: ICAR_IDS.map((itemId, i) => ({ itemId, selectedIndex: i % 4 })),
  wleis: WLEIS_IDS.map((itemId, i) => ({ itemId, value: (i % 7) + 1 })),
});

describe('validateSubmission', () => {
  it('accepts a well-formed payload', () => {
    // Arrange
    const payload = validPayload();
    // Act
    const result = validateSubmission(payload, bank);
    // Assert
    expect(result.sessionId).toBe('sess_abc123');
    const expectedIcarLength = bank.cognitive.items.length;
    const expectedWleisLength = bank.wleis.items.length;
    expect(result.icar).toHaveLength(expectedIcarLength);
    expect(result.wleis).toHaveLength(expectedWleisLength);
  });

  it('rejects a payload missing sessionId', () => {
    // Arrange
    const { sessionId: _omitted, ...payload } = validPayload();
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects a payload containing correctAnswerKey (client-side key leak)', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[0] = { ...payload.icar[0], correctAnswerKey: '23' };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow(/key|forbidden/i);
  });

  it('rejects a payload containing correctIndex', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[0] = { ...payload.icar[0], correctIndex: 0 };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow(/key|forbidden/i);
  });

  it('rejects a payload containing irt parameters', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[0] = { ...payload.icar[0], irt: { a: 1, b: 0, c: 0.2 } };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow(/key|forbidden/i);
  });

  it('rejects non-integer or out-of-range selectedIndex', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[0] = { itemId: ICAR_IDS[0], selectedIndex: 4 };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects out-of-range Likert values', () => {
    // Arrange
    const payload = validPayload();
    payload.wleis[0] = { itemId: WLEIS_IDS[0], value: 8 };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects duplicate itemIds', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[1] = { ...payload.icar[0] };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects unknown item ids', () => {
    // Arrange
    const payload = validPayload();
    payload.icar[0] = { itemId: 'NOPE', selectedIndex: 0 };
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects wrong item counts', () => {
    // Arrange
    const payload = validPayload();
    const expectedLength = bank.cognitive.items.length;
    payload.icar = payload.icar.slice(0, expectedLength - 1);
    // Act / Assert
    expect(() => validateSubmission(payload, bank)).toThrow();
  });

  it('rejects null and malformed payloads', () => {
    // Act / Assert
    expect(() => validateSubmission(null, bank)).toThrow();
    expect(() => validateSubmission({}, bank)).toThrow();
    expect(() => validateSubmission(42, bank)).toThrow();
  });
});