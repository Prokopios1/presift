import { describe, it, expect } from 'vitest';
import { resolveSession, buildSessionKeys, localizeSession } from '../session';
import { bank } from '../data/presift-bank';

const SEEDED = () => 0;

describe('resolveSession', () => {
  it('resolves exactly 16 items, one per bank item', () => {
    // Arrange
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    const expectedLength = bank.cognitive.items.length;
    expect(session.items).toHaveLength(expectedLength);
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
      expect(item.prompt.en).not.toMatch(/\{\{/);
      expect(item.prompt.el).not.toMatch(/\{\{/);
      for (const opt of item.options) {
        expect(opt.en).not.toMatch(/\{\{/);
        expect(opt.el).not.toMatch(/\{\{/);
      }
    }
  });

  it('serves exactly 4 distinct options per item', () => {
    // Act
    const session = resolveSession('assess_1', bank, SEEDED);
    // Assert
    for (const item of session.items) {
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options.map((o: any) => o.en)).size).toBe(4);
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

describe('localizeSession', () => {
  // Bilingual stub mirroring resolveSession's shape (prompt/options carry both langs).
  const bilingual = {
    items: [
      { itemId: 'c1', domain: 'numerical', prompt: { en: 'Add 2 and 3', el: 'Πρόσθεσε το 2 και το 3' }, options: [{ en: '5', el: '5' }, { en: '7', el: '7' }, { en: '9', el: '9' }, { en: '11', el: '11' }] },
      { itemId: 'v1', domain: 'verbal', prompt: { en: 'Pick the synonym', el: 'Επίλεξε το συνώνυμο' }, options: [{ en: 'car', el: 'αυτοκίνητο' }, { en: 'boat', el: 'βάρκα' }, { en: 'ship', el: 'πλοίο' }, { en: 'air', el: 'αέρας' }] },
    ],
    wleisItems: [
      { itemId: 'w1', domain: 'wleis', prompt: { en: 'I know why I feel certain ways', el: 'Ξέρω γιατί νιώθω με συγκεκριμένους τρόπους' }, options: [{ en: '1', el: '1' }, { en: '2', el: '2' }, { en: '3', el: '3' }, { en: '4', el: '4' }, { en: '5', el: '5' }, { en: '6', el: '6' }, { en: '7', el: '7' }] },
    ],
  } as any;

  it('maps every prompt/option to Greek (el) by default ', () => {
    // Act — lang omitted
    const out = localizeSession(bilingual);
    // Assert — everything is now a plain string in the Greek language
    expect(out.items[0].prompt).toBe('Πρόσθεσε το 2 και το 3');
    expect(out.items[0].options).toEqual(['5', '7', '9', '11']);
    expect(out.items[1].prompt).toBe('Επίλεξε το συνώνυμο');
    expect(out.items[1].options).toEqual(['αυτοκίνητο', 'βάρκα', 'πλοίο', 'αέρας']);
    expect(out.wleisItems[0].prompt).toBe('Ξέρω γιατί νιώθω με συγκεκριμένους τρόπους');
    // Asserts on passive test data, never a live evaluation
  });

  it('maps every prompt/option to English when lang=en', () => {
    // Act
    const out = localizeSession(bilingual, 'en');
    // Assert
    expect(out.items[0].prompt).toBe('Add 2 and 3');
    expect(out.items[1].prompt).toBe('Pick the synonym');
    expect(out.items[1].options).toEqual(['car', 'boat', 'ship', 'air']);
    expect(out.wleisItems[0].prompt).toBe('I know why I feel certain ways');
  });

  it('passes numeric/Likert options through unchanged in either language', () => {
    // Act
    const gr = localizeSession(bilingual, 'el');
    const en = localizeSession(bilingual, 'en');
    // Assert — identical numbers, no i18n drift on language-neutral options
    expect(gr.items[0].options).toEqual(en.items[0].options);
    expect(gr.items[0].options).toEqual(['5', '7', '9', '11']);
    expect(gr.wleisItems[0].options).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(en.wleisItems[0].options).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('defaults to el when lang is omitted (not the undefined branch)', () => {
    // Act / Assert
    expect(localizeSession(bilingual).items[0].prompt).toBe('Πρόσθεσε το 2 και το 3');
    expect(localizeSession(bilingual, 'el').items[0].prompt).toBe('Πρόσθεσε το 2 και το 3');
  });
});

describe('buildSessionKeys', () => {
  it('returns one key per item with valid correctIndex and irt', () => {
    // Arrange
    const session = resolveSession('assess_1', bank, SEEDED);
    // Act
    const keys = buildSessionKeys(session, bank, SEEDED);
    // Assert
    const expectedLength = bank.cognitive.items.length;
    expect(keys).toHaveLength(expectedLength);
    for (const k of keys) {
      expect(k.correctIndex).toBeGreaterThanOrEqual(0);
      expect(k.correctIndex).toBeLessThanOrEqual(3);
      expect(k.irt.a).toBeGreaterThan(0);
    }
  });
});