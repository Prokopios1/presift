import { describe, it, expect } from 'vitest';
import { resolveSession, buildSessionKeys } from '../session';
import { bank } from '../data/presift-bank';

const RNG_A = () => 0.1;
const RNG_B = () => 0.9;

describe('session parameterization (iteration 5)', () => {
  it('resolves exactly 16 items, one per bank item', () => {
    // Arrange
    // Act
    const session = resolveSession('assess_1', bank, RNG_A);
    // Assert
    expect(session.items).toHaveLength(16);
    expect(session.items.map((i) => i.itemId)).toEqual(bank.cognitive.items.map((i) => i.id));
  });

  it('resolves all templates — no "{{" remains in prompt or options', () => {
    // Act
    const session = resolveSession('assess_1', bank, RNG_A);
    // Assert
    for (const item of session.items) {
      expect(item.prompt).not.toMatch(/\{\{/);
      for (const opt of item.options) expect(opt).not.toMatch(/\{\{/);
    }
  });

  it('serves exactly 4 distinct non-empty options per item', () => {
    // Act
    const session = resolveSession('assess_1', bank, RNG_A);
    // Assert
    for (const item of session.items) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      for (const opt of item.options) expect(opt.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic under a seeded rng', () => {
    // Arrange
    // Act
    const a = resolveSession('assess_1', bank, RNG_A);
    const b = resolveSession('assess_1', bank, RNG_A);
    // Assert
    expect(a.items).toEqual(b.items);
  });

  it('different rng seeds produce different sessions (parameterization + shuffle active)', () => {
    // Arrange
    // Act
    const a = resolveSession('assess_1', bank, RNG_A);
    const b = resolveSession('assess_1', bank, RNG_B);
    // Assert
    const rendered = (s: { prompt: string; options: string[] }[]) =>
      s.map((i) => i.prompt + '|' + i.options.join(',')).join(';');
    expect(rendered(a.items)).not.toBe(rendered(b.items));
  });

  it('never exposes answer data in the client payload', () => {
    // Arrange
    const forbidden = ['correctIndex', 'correctAnswerKey', 'difficulty', 'irt', 'parameterization'];
    // Act
    const session = resolveSession('assess_1', bank, RNG_A);
    // Assert
    for (const item of session.items) {
      for (const key of forbidden) expect(Object.keys(item)).not.toContain(key);
    }
  });
});

describe('buildSessionKeys (iteration 5)', () => {
  it('returns one key per item with valid correctIndex and irt', () => {
    // Arrange
    const session = resolveSession('assess_1', bank, RNG_A);
    // Act
    const keys = buildSessionKeys(session, bank, RNG_A);
    // Assert
    expect(keys).toHaveLength(16);
    for (const k of keys) {
      expect(Number.isInteger(k.correctIndex)).toBe(true);
      expect(k.correctIndex).toBeGreaterThanOrEqual(0);
      expect(k.correctIndex).toBeLessThanOrEqual(3);
      expect(k.irt.a).toBeGreaterThan(0);
    }
  });

  it('keys map to existing options in the resolved session', () => {
    // Arrange
    const session = resolveSession('assess_1', bank, RNG_A);
    // Act
    const keys = buildSessionKeys(session, bank, RNG_A);
    // Assert
    for (const k of keys) {
      const item = session.items.find((i) => i.itemId === k.itemId);
      expect(item).toBeDefined();
      expect(item!.options[k.correctIndex]).toBeDefined();
    }
  });
});
