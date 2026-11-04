import { describe, it, expect } from 'vitest';
import { calculatePearsonCorrelation, getCorrelationDescriptor, type BenchmarkPair } from '../lib/psychometrics';

describe('psychometrics - calculatePearsonCorrelation', () => {
  it('returns null when pairs length is less than 3', () => {
    const pairs: BenchmarkPair[] = [
      { name: 'Alice', managerRating: 8, presiftScore: 8 },
      { name: 'Bob', managerRating: 6, presiftScore: 6 }
    ];
    expect(calculatePearsonCorrelation(pairs)).toBeNull();
  });

  it('calculates perfect positive correlation (r = 1.0)', () => {
    const pairs: BenchmarkPair[] = [
      { name: 'Alice', managerRating: 4, presiftScore: 4 },
      { name: 'Bob', managerRating: 7, presiftScore: 7 },
      { name: 'Charlie', managerRating: 9, presiftScore: 9 }
    ];
    const r = calculatePearsonCorrelation(pairs);
    expect(r).not.toBeNull();
    expect(Math.round(r! * 100) / 100).toBe(1);
    expect(getCorrelationDescriptor(r).percent).toBe(100);
    expect(getCorrelationDescriptor(r).label).toBe('Strong Alignment');
  });

  it('calculates strong positive correlation', () => {
    const pairs: BenchmarkPair[] = [
      { name: 'Alice', managerRating: 5, presiftScore: 6 },
      { name: 'Bob', managerRating: 7, presiftScore: 7 },
      { name: 'Charlie', managerRating: 8, presiftScore: 9 },
      { name: 'Dave', managerRating: 9, presiftScore: 8 }
    ];
    const r = calculatePearsonCorrelation(pairs);
    expect(r).toBeGreaterThan(0.7);
    expect(getCorrelationDescriptor(r).label).toBe('Strong Alignment');
  });

  it('returns null on zero variance in manager ratings', () => {
    const pairs: BenchmarkPair[] = [
      { name: 'Alice', managerRating: 7, presiftScore: 5 },
      { name: 'Bob', managerRating: 7, presiftScore: 8 },
      { name: 'Charlie', managerRating: 7, presiftScore: 9 }
    ];
    expect(calculatePearsonCorrelation(pairs)).toBeNull();
  });
});
