import { describe, it, expect } from 'vitest';
import {
  transformLikert, estimateTheta, mapToScale, scoreWleis, evaluateCandidate,
  type IrtParams, type WleisAnswer,
} from '../psychometrics';

const PARAMS: IrtParams[] = [
  { a: 1.1, b: -0.94, c: 0.15 },
  { a: 1.3, b: -0.32, c: 0.20 },
  { a: 1.2, b: -0.20, c: 0.20 },
  { a: 1.0, b: -0.62, c: 0.15 },
  { a: 0.9, b: -1.73, c: 0.20 },
  { a: 1.0, b: -1.27, c: 0.20 },
  { a: 1.1, b: -0.85, c: 0.20 },
  { a: 0.8, b: -0.49, c: 0.25 },
  { a: 1.0, b: -0.75, c: 0.20 },
  { a: 0.9, b: -0.41, c: 0.20 },
  { a: 1.2, b: -2.20, c: 0.20 },
  { a: 1.1, b: -1.73, c: 0.20 },
  { a: 1.4, b: -0.20, c: 0.20 },
  { a: 1.3, b: -1.10, c: 0.20 },
  { a: 1.5, b: 0.20, c: 0.20 },
  { a: 1.4, b: 0.00, c: 0.20 },
];

describe('transformLikert', () => {
  it('returns the raw value when reverse is false', () => {
    // Arrange
    const cases = [1, 4, 7];
    // Act / Assert
    for (const v of cases) expect(transformLikert(v, false)).toBe(v);
  });

  it('maps reverse-scored 1-7 Likert via 8 - value', () => {
    // Arrange
    const cases: Array<[number, number]> = [[1, 7], [4, 4], [7, 1], [2, 6], [6, 2]];
    // Act / Assert
    for (const [input, expected] of cases) expect(transformLikert(input, true)).toBe(expected);
  });

  it('throws on out-of-range Likert values', () => {
    // Arrange
    const bad = [0, 8, -1, 7.5, NaN];
    // Act / Assert
    for (const v of bad) expect(() => transformLikert(v, false)).toThrow();
  });
});

describe('estimateTheta', () => {
  it('returns a finite positive theta for an all-correct vector', () => {
    // Arrange
    const vector = PARAMS.map(() => 1);
    // Act
    const theta = estimateTheta(vector, PARAMS);
    // Assert
    expect(Number.isFinite(theta)).toBe(true);
    expect(theta).toBeGreaterThan(0);
  });

  it('returns a finite negative theta for an all-incorrect vector', () => {
    // Arrange
    const vector = PARAMS.map(() => 0);
    // Act
    const theta = estimateTheta(vector, PARAMS);
    // Assert
    expect(Number.isFinite(theta)).toBe(true);
    expect(theta).toBeLessThan(0);
  });

  it('is monotonic in raw score', () => {
    // Arrange
    const low = PARAMS.map((_, i) => (i < 6 ? 1 : 0));
    const high = PARAMS.map((_, i) => (i < 10 ? 1 : 0));
    // Act
    const tLow = estimateTheta(low, PARAMS);
    const tHigh = estimateTheta(high, PARAMS);
    // Assert
    expect(tHigh).toBeGreaterThan(tLow);
  });

  it('throws on mismatched vector/params lengths', () => {
    // Arrange
    const vector = [1, 0, 1];
    // Act / Assert
    expect(() => estimateTheta(vector, PARAMS)).toThrow();
  });

  it('throws on non-binary responses', () => {
    // Arrange
    const vector = PARAMS.map(() => 2 as number);
    // Act / Assert
    expect(() => estimateTheta(vector, PARAMS)).toThrow();
  });

  it('throws on empty vectors', () => {
    // Act / Assert
    expect(() => estimateTheta([], [])).toThrow();
  });
});

describe('mapToScale', () => {
  it('maps theta 0 to percentile 50 and standard score 100', () => {
    // Act
    const s = mapToScale(0);
    // Assert
    expect(s.percentile).toBeCloseTo(50, 1);
    expect(s.standardScore).toBe(100);
  });

  it('maps theta 1 to ~84.13 percentile and standard score 115', () => {
    // Act
    const s = mapToScale(1);
    // Assert
    expect(s.percentile).toBeCloseTo(84.13, 1);
    expect(s.standardScore).toBe(115);
  });

  it('maps theta -1 to ~15.87 percentile', () => {
    // Act
    const s = mapToScale(-1);
    // Assert
    expect(s.percentile).toBeCloseTo(15.87, 1);
  });

  it('clamps percentile to (0.1, 99.9)', () => {
    // Act
    const s = mapToScale(6);
    // Assert
    expect(s.percentile).toBeLessThanOrEqual(99.9);
  });
});

describe('scoreWleis', () => {
  it('applies reverse scoring and totals per subscale', () => {
    // Arrange
    const answers: WleisAnswer[] = [
      { subscale: 'SEA', value: 6, reverse: false },
      { subscale: 'SEA', value: 2, reverse: true },  // -> 6
      { subscale: 'OEA', value: 7, reverse: false },
      { subscale: 'UOE', value: 1, reverse: true },  // -> 7
      { subscale: 'ROE', value: 3, reverse: false },
    ];
    // Act
    const s = scoreWleis(answers);
    // Assert
    expect(s.SEA).toBe(12); // 6 + 6
    expect(s.OEA).toBe(7);
    expect(s.UOE).toBe(7);
    expect(s.ROE).toBe(3);
    expect(s.Total).toBe(29);
  });

  it('throws when a subscale is invalid', () => {
    // Arrange
    const answers = [{ subscale: 'XYZ', value: 4, reverse: false }] as unknown as WleisAnswer[];
    // Act / Assert
    expect(() => scoreWleis(answers)).toThrow();
  });
});

describe('evaluateCandidate', () => {
  it('produces a complete ScoringResult', () => {
    // Arrange
    const vector = PARAMS.map(() => 1);
    const subscales: WleisAnswer['subscale'][] = ['SEA', 'OEA', 'UOE', 'ROE'];
    const wleis: WleisAnswer[] = PARAMS.map((_, i) => ({
      subscale: subscales[i % 4],
      value: (i % 7) + 1,
      reverse: i % 3 === 0,
    }));
    // Act
    const result = evaluateCandidate(vector, wleis, PARAMS);
    // Assert
    expect(result.icar.rawScore).toBe(16);
    expect(result.icar.maxRawScore).toBe(16);
    expect(result.icar.standardScore).toBeGreaterThan(100);
    expect(result.icar.percentile).toBeGreaterThan(50);
    expect(Object.keys(result.wleis.rawScores)).toEqual(['SEA', 'OEA', 'UOE', 'ROE', 'Total']);
  });
});