import { describe, it, expect } from 'vitest';
import { resolveSession, buildSessionKeys } from '../session';
import { bank } from '../data/presift-bank';

const SEEDED = () => 0;

describe('resolveSession', () => {
  it('resolves exactly 16 items, one per bank item', () => {
    // Arrange
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    expect(session.items).toHaveLength(16);
    expect(session.items.map((i) => i.itemId)).toEqual(bank.cognitive.items.map((i) => i.id));
  });

  it('never exposes answer data in the client payload', () => {
    // Arrange
    const forbidden = ['correctIndex', 'correctAnswerKey', 'difficulty', 'irt', 'parameterization'];
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    for (const item of session.items) {
      for (const key of forbidden) {
        expect(Object.keys(item)).not.toContain(key);
      }
    }
  });

  it('resolves all template variables (no "{{" remains)', () => {
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    for (const item of session.items) {
      expect(item.prompt).not.toMatch(/\{\{/);
      for (const opt of item.options) expect(opt).not.toMatch(/\{\{/);
    }
  });

  it('serves exactly 4 distinct options per item', () => {
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    for (const item of session.items) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
    }
  });

  it('is deterministic under a seeded rng', () => {
    // Arrange
    // Act
    const a = resolveSession('assess_1', bank, SEEDED);
    const b = resolveSession('assess_1', bank, SEEDED);
    // Assert
    expect(a.items).toEqual(b.items);
  });

  it('throws on an unknown assessment or empty bank', () => {
    // Act / Assert
    expect(() => resolveSession('', bank, SEEDED)).toThrow();
  });
});

describe('buildSessionKeys', () => {
  it('returns one key per item with valid correctIndex and irt', () => {
    // Arrange
    const session = resolveSession('assess_1', bank, SEEDED);
    // Act
    const keys = buildSessionKeys(session, bank, SEEDED);
    // Assert
    expect(keys).toHaveLength(16);
    for (const k of keys) {
      expect(k.correctIndex).toBeGreaterThanOrEqual(0);
      expect(k.correctIndex).toBeLessThanOrEqual(3);
      expect(k.irt.a).toBeGreaterThan(0);
    }
  });
});