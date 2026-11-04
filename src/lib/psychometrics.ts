/**
 * Psychometric & Statistical utilities for Team Benchmark studies.
 */

export interface BenchmarkPair {
  name: string;
  managerRating: number; // 1-10
  presiftScore: number;  // 1-10 scaled index
}

/**
 * Calculates the Pearson correlation coefficient (r) between manager ratings and preSift scores.
 * Returns null if N < 3 or if standard deviation is 0.
 */
export function calculatePearsonCorrelation(pairs: BenchmarkPair[]): number | null {
  if (pairs.length < 3) return null;

  const n = pairs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const pair of pairs) {
    const x = pair.managerRating;
    const y = pair.presiftScore;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0 || isNaN(denominator)) return null;

  const r = numerator / denominator;
  // Clamp to [-1, 1] to avoid float precision artifacts
  return Math.max(-1, Math.min(1, r));
}

/**
 * Converts Pearson r into a recruiter-friendly alignment percentage and verbal descriptor.
 * E.g., r = 0.85 -> 85% Strong Alignment
 */
export function getCorrelationDescriptor(r: number | null): { percent: number; label: string } {
  if (r === null) {
    return { percent: 0, label: 'Insufficient Data' };
  }

  // Treat positive correlation as alignment percentage
  const percent = Math.round(Math.max(0, r) * 100);

  if (r >= 0.7) {
    return { percent, label: 'Strong Alignment' };
  } else if (r >= 0.4) {
    return { percent, label: 'Moderate Alignment' };
  } else if (r >= 0) {
    return { percent, label: 'Emerging Alignment' };
  } else {
    return { percent: 0, label: 'Negative / Inverse Correlation' };
  }
}
