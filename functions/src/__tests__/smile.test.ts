import { describe, it, expect } from 'vitest';
import { validateSmileAnswers, calibrateWLEIS, scoreSmileTask } from '../smile';
import { bank } from '../data/presift-bank';

const SMILE_TRIALS = bank.smileTask?.trials || [];

const buildValidAnswers = () =>
  SMILE_TRIALS.map((t, idx) => ({
    trialId: t.trialId,
    perceived: (idx % 2 === 0 ? 'genuine' : 'fake') as 'genuine' | 'fake',
    rtMs: 1200 + idx * 50,
  }));

describe('Smile Perception Module (smile.ts)', () => {
  describe('validateSmileAnswers', () => {
    it('accepts valid 20 smile trial answers', () => {
      const valid = buildValidAnswers();
      const validated = validateSmileAnswers(valid, SMILE_TRIALS);
      expect(validated).toHaveLength(20);
      expect(validated[0].perceived).toBe('genuine');
    });

    it('rejects payload missing a trial', () => {
      const valid = buildValidAnswers();
      const incomplete = valid.slice(0, 19);
      expect(() => validateSmileAnswers(incomplete, SMILE_TRIALS)).toThrow(/ERR_SMILE_LENGTH_MISMATCH/);
    });

    it('rejects payload with duplicate trialId', () => {
      const valid = buildValidAnswers();
      valid[1] = { ...valid[0] };
      expect(() => validateSmileAnswers(valid, SMILE_TRIALS)).toThrow(/ERR_DUPLICATE_TRIAL_ID/);
    });

    it('rejects invalid perceived response string', () => {
      const valid = buildValidAnswers();
      (valid[0] as any).perceived = 'happy';
      expect(() => validateSmileAnswers(valid, SMILE_TRIALS)).toThrow(/ERR_INVALID_PERCEIVED_STRING/);
    });

    it('rejects negative reaction time rtMs < 0', () => {
      const valid = buildValidAnswers();
      valid[0].rtMs = -500;
      expect(() => validateSmileAnswers(valid, SMILE_TRIALS)).toThrow(/ERR_INVALID_RT_MS/);
    });
  });

  describe('scoreSmileTask', () => {
    it('scores 100% accuracy when all answers match ground truth', () => {
      const perfectAnswers = SMILE_TRIALS.map((t) => ({
        trialId: t.trialId,
        perceived: t.groundTruth as 'genuine' | 'fake',
        rtMs: 1000,
      }));

      const res = scoreSmileTask(perfectAnswers, SMILE_TRIALS, 5.0);
      expect(res.score).toBe(20);
      expect(res.accuracy).toBe(1.0);
      expect(res.calibration.calibratedOeaScore).toBe(5.0);
      expect(res.calibration.level).toBe('High');
    });

    it('scores 0% accuracy when all answers invert ground truth', () => {
      const zeroAnswers = SMILE_TRIALS.map((t) => ({
        trialId: t.trialId,
        perceived: (t.groundTruth === 'genuine' ? 'fake' : 'genuine') as 'genuine' | 'fake',
        rtMs: 1000,
      }));

      const res = scoreSmileTask(zeroAnswers, SMILE_TRIALS, 5.0);
      expect(res.score).toBe(0);
      expect(res.accuracy).toBe(0.0);
      expect(res.calibration.biasDirection).toBe('overestimating');
      expect(res.calibration.level).toBe('Slight');
    });
  });

  describe('calibrateWLEIS', () => {
    it('minimal bias and High alignment when accuracy matches raw OEA', () => {
      // Accuracy = 1.0 (100%), raw OEA = 5.0 (max)
      // Normalized accuracy = (1.0 * 4) + 1 = 5.0
      // Bias = 5.0 - 5.0 = 0.0 -> High alignment
      const cal = calibrateWLEIS(5.0, 1.0);
      expect(cal.rawOea).toBe(5.0);
      expect(cal.accuracy).toBe(1.0);
      expect(cal.bias).toBeCloseTo(0.0, 2);
      expect(cal.biasDirection).toBe('balanced');
      expect(cal.level).toBe('High');
      expect(cal.calibratedOeaScore).toBe(5.0);
    });

    it('identifies overestimating bias when raw OEA is high but accuracy is low', () => {
      // Raw OEA = 4.8, Accuracy = 0.2 (20%) -> Normalized acc = 1.8
      // Bias = 4.8 - 1.8 = 3.0 -> overestimating
      const cal = calibrateWLEIS(4.8, 0.2);
      expect(cal.bias).toBeGreaterThan(0.3);
      expect(cal.biasDirection).toBe('overestimating');
      expect(cal.level).toBe('Slight');
      expect(cal.calibratedOeaScore).toBeLessThan(4.8);
      expect(cal.calibratedOeaScore).toBeGreaterThanOrEqual(1.0);
    });

    it('identifies underestimating bias when raw OEA is low but accuracy is high', () => {
      // Raw OEA = 2.0, Accuracy = 0.9 (90%) -> Normalized acc = 4.6
      // Bias = 2.0 - 4.6 = -2.6 -> underestimating
      const cal = calibrateWLEIS(2.0, 0.9);
      expect(cal.bias).toBeLessThan(-0.3);
      expect(cal.biasDirection).toBe('underestimating');
      expect(cal.calibratedOeaScore).toBeGreaterThan(2.0);
    });

    it('bounds calibrated score strictly inside [1, 5]', () => {
      const calHigh = calibrateWLEIS(5.0, 1.0);
      const calLow = calibrateWLEIS(1.0, 0.0);
      expect(calHigh.calibratedOeaScore).toBeLessThanOrEqual(5.0);
      expect(calHigh.calibratedOeaScore).toBeGreaterThanOrEqual(1.0);
      expect(calLow.calibratedOeaScore).toBeLessThanOrEqual(5.0);
      expect(calLow.calibratedOeaScore).toBeGreaterThanOrEqual(1.0);
    });
  });
});
