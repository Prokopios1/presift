import { describe, it, expect } from 'vitest';
import { buildDemoData } from '../seeder';

describe('buildDemoData', () => {
  it('returns a demo recruiter with 5 credits and VAT info', () => {
    // Arrange
    // Act
    const data = buildDemoData();
    // Assert
    expect(data.recruiter.email).toBe('demo_recruiter@presift.app');
    expect(data.recruiter.credits).toBe(5);
    expect(data.recruiter.vatId).toBeTruthy();
  });

  it('creates exactly 3 active assessment links', () => {
    // Act
    const data = buildDemoData();
    // Assert
    expect(data.assessments).toHaveLength(3);
    for (const a of data.assessments) expect(a.active).toBe(true);
  });

  it('creates 9 candidates with 2 strong / 3 conditional / 2 low / 1 locked / 1 integrity flag', () => {
    // Act
    const data = buildDemoData();
    // Assert
    expect(data.candidates).toHaveLength(9);
    const strong = data.candidates.filter((c) => c.fitBadge.includes('Strong Fit'));
    const conditional = data.candidates.filter((c) => c.fitBadge.includes('Conditional Fit'));
    const low = data.candidates.filter((c) => c.fitBadge.includes('Low Fit'));
    const locked = data.candidates.filter((c) => c.fitBadge.includes('Locked'));
    const integrity = data.candidates.filter((c) => c.fitBadge.includes('Integrity Flag'));
    expect(strong).toHaveLength(2);
    expect(conditional).toHaveLength(3);
    expect(low).toHaveLength(2);
    expect(locked).toHaveLength(1);
    expect(integrity).toHaveLength(1);
  });

  it('locks exactly one candidate and it is Frank Pending', () => {
    // Act
    const data = buildDemoData();
    // Assert
    const lockedCandidates = data.candidates.filter((c) => c.isLocked);
    expect(lockedCandidates).toHaveLength(1);
    expect(lockedCandidates[0].name).toBe('Frank Pending');
  });

  it('flags exactly one candidate with 3+ integrity events', () => {
    // Act
    const data = buildDemoData();
    // Assert
    const flagged = data.candidates.filter((c) => (c.integrityEvents?.length ?? 0) >= 3);
    expect(flagged).toHaveLength(1);
  });

  it('produces scoreResults matching the engine schema', () => {
    // Act
    const data = buildDemoData();
    // Assert
    for (const c of data.candidates) {
      expect(c.scoreResult.icar.percentile).toBeGreaterThanOrEqual(0);
      expect(c.scoreResult.icar.percentile).toBeLessThanOrEqual(100);
      expect(c.scoreResult.icar.standardScore).toBeGreaterThanOrEqual(40);
      expect(c.scoreResult.wleis.rawScores).toHaveProperty('SEA');
      expect(c.scoreResult.wleis.rawScores).toHaveProperty('OEA');
      expect(c.scoreResult.wleis.rawScores).toHaveProperty('UOE');
      expect(c.scoreResult.wleis.rawScores).toHaveProperty('ROE');
    }
  });
});