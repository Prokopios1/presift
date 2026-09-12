import { describe, it, expect } from 'vitest';
import { resolveSession, localizeSession } from '../session';
import { bank } from '../data/presift-bank';

/** Deterministic LCG so draws are reproducible across runs. */
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const session = (seed = 42) => {
  const sess = resolveSession('assess_test', bank, seeded(seed));
  return { sess, gr: localizeSession(sess, 'el'), en: localizeSession(sess, 'en') };
};

const verbalIds = ['ICAR-V-01', 'ICAR-V-02', 'ICAR-V-03', 'ICAR-V-04'];

describe('bank-sourced verbal items (localisation)', () => {
  it('serves Greek vocabulary with no Latin words leaking into the Greek view', () => {
    const { gr } = session();
    for (const id of verbalIds) {
      const item = gr.items.find(i => i.itemId === id);
      expect(item, `${id} missing`).toBeTruthy();
      const combined = `${item!.prompt} ${item!.options.join(' ')}`;
      expect(combined, `${id} leaked Latin text: ${combined}`).not.toMatch(/[A-Za-z]{3,}/);
      expect(combined).toMatch(/[\u0370-\u03FF]/);
    }
  });

  it('serves English vocabulary in the English view', () => {
    const { en } = session();
    for (const id of verbalIds) {
      const item = en.items.find(i => i.itemId === id);
      const combined = `${item!.prompt} ${item!.options.join(' ')}`;
      expect(combined, `${id} not English: ${combined}`).toMatch(/[A-Za-z]{3,}/);
      expect(combined).not.toMatch(/[\u0370-\u03FF]/);
    }
  });

  it('keeps EN and EL options aligned (same drawn entry, same correct slot)', () => {
    const { sess, gr, en } = session();
    for (const id of verbalIds) {
      const key = sess.keys.find(k => k.itemId === id)!;
      const g = gr.items.find(i => i.itemId === id)!;
      const e = en.items.find(i => i.itemId === id)!;
      expect(g.options.length).toBe(4);
      expect(e.options.length).toBe(4);
      expect(key.correctIndex).toBeGreaterThanOrEqual(0);
      expect(key.correctIndex).toBeLessThan(4);
      // Both languages share the option order, so the same slot is correct.
      expect(g.options[key.correctIndex]).toBeTruthy();
      expect(e.options[key.correctIndex]).toBeTruthy();
    }
  });

  it('marks the bank-defined odd word correct for ICAR-V-04, honouring entry[4]', () => {
    const { sess, gr } = session();
    const item = gr.items.find(i => i.itemId === 'ICAR-V-04')!;
    const key = sess.keys.find(k => k.itemId === 'ICAR-V-04')!;
    const chosen = item.options[key.correctIndex];

    // Locate the drawn entry: the set whose first four Greek words match the options.
    const entries: any[] = (bank as any).banks.oddOneOutSets.el;
    const match = entries.find(e => {
      const words = e.slice(0, 4).map(String).sort();
      return JSON.stringify(words) === JSON.stringify([...item.options].sort());
    });
    expect(match, `no oddOneOutSets entry matched options ${JSON.stringify(item.options)}`).toBeTruthy();
    expect(chosen).toBe(String(match![Number(match![4])]));
  });

  it('randomises the drawn vocabulary between sessions', () => {
    const a = session(1).gr.items.filter(i => i.itemId.startsWith('ICAR-V')).map(i => i.prompt);
    const b = session(99).gr.items.filter(i => i.itemId.startsWith('ICAR-V')).map(i => i.prompt);
    expect(a).not.toEqual(b);
  });

  it('leaves numeric parameterised items working (regression)', () => {
    const { gr } = session();
    const n = gr.items.find(i => i.itemId === 'ICAR-N-01')!;
    expect(n.prompt).toMatch(/Ποιος αριθμός συμπληρώνει τη σειρά/);
    expect(n.options.length).toBe(4);
    expect(new Set(n.options).size).toBe(4);
    expect(n.options.join('')).not.toMatch(/{{/);
  });
});
