import { describe, it, expect } from 'vitest';
import { buildDemoData } from '../seeder';

describe('buildDemoData full schema (iteration 5)', () => {
  it('every scoreResult matches the complete ScoringResult schema', () => {
    // Arrange
    // Act
    const data = buildDemoData();
    // Assert
    for (const c of data.candidates) {
      const icar = c.scoreResult.icar;
      expect(Number.isInteger(icar.rawScore)).toBe(true);
      expect(Number.isInteger(icar.maxRawScore)).toBe(true);
      expect(Number.isFinite(icar.theta)).toBe(true);
      expect(Number.isInteger(icar.standardScore)).toBe(true);
      expect(icar.percentile).toBeGreaterThanOrEqual(0);
      expect(icar.percentile).toBeLessThanOrEqual(100);
      const w = c.scoreResult.wleis.rawScores;
      for (const sub of ['SEA', 'OEA', 'UOE', 'ROE', 'Total']) {
        expect(typeof w[sub as keyof typeof w]).toBe('number');
      }
    }
  });

  it('candidate records carry every contract field', () => {
    // Act
    const data = buildDemoData();
    // Assert
    for (const c of data.candidates) {
      expect(typeof c.name).toBe('string');
      expect(typeof c.appliedRole).toBe('string');
      expect(typeof c.fitBadge).toBe('string');
      expect(typeof c.status).toBe('string');
      expect(Array.isArray(c.integrityEvents)).toBe(true);
      expect(typeof c.isLocked).toBe('boolean');
      expect(typeof c.completionDate).toBe('string');
      expect(typeof c.duration).toBe('number');
      expect(typeof c.email).toBe('string');
    }
  });

  it('integrity events follow the {type, at} shape', () => {
    // Act
    const data = buildDemoData();
    // Assert
    for (const c of data.candidates) {
      for (const ev of c.integrityEvents) {
        expect(typeof ev.type).toBe('string');
        expect(typeof ev.at).toBe('number');
      }
    }
  });
});
