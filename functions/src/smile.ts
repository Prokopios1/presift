export interface SmileTrialConfig {
  trialId: string;
  start: number;
  end: number;
  groundTruth: 'genuine' | 'fake';
}

export interface SmileAnswer {
  trialId: string;
  perceived: 'genuine' | 'fake';
  rtMs: number;
}

export interface SmileScoringResult {
  score: number;
  total: number;
  accuracy: number;
  answers: Array<{
    trialId: string;
    perceived: 'genuine' | 'fake';
    correct: boolean;
    rtMs: number;
  }>;
  calibration: {
    rawOea: number;
    calibratedOeaScore: number;
    accuracy: number;
    bias: number;
    biasDirection: 'overestimating' | 'underestimating' | 'balanced';
    level: 'High' | 'Moderate' | 'Slight';
    notes: string;
  };
}

export function validateSmileAnswers(answers: any, trials: SmileTrialConfig[]): SmileAnswer[] {
  if (!Array.isArray(answers)) {
    throw new Error('smileAnswers must be an array');
  }

  if (answers.length !== trials.length) {
    throw new Error(`Expected ${trials.length} answers, received ${answers.length}`);
  }

  const validTrialIds = new Set(trials.map((t) => t.trialId));
  const seenTrialIds = new Set<string>();

  const validated: SmileAnswer[] = [];

  for (const ans of answers) {
    if (!ans || typeof ans !== 'object') {
      throw new Error('Invalid answer object');
    }

    const { trialId, perceived, rtMs } = ans;

    if (!trialId || !validTrialIds.has(trialId)) {
      throw new Error(`Invalid trialId: ${trialId}`);
    }

    if (seenTrialIds.has(trialId)) {
      throw new Error(`Duplicate trialId: ${trialId}`);
    }
    seenTrialIds.add(trialId);

    if (perceived !== 'genuine' && perceived !== 'fake') {
      throw new Error(`Invalid perceived string: ${perceived}`);
    }

    if (typeof rtMs !== 'number' || isNaN(rtMs) || rtMs < 0) {
      throw new Error(`Invalid rtMs: ${rtMs}`);
    }

    validated.push({
      trialId,
      perceived,
      rtMs,
    });
  }

  return validated;
}

export function calibrateWLEIS(rawOea: number, accuracy: number) {
  const normalizedAccuracy = accuracy * 4 + 1; // map [0, 1] -> [1, 5]
  const bias = rawOea - normalizedAccuracy;

  let biasDirection: 'overestimating' | 'underestimating' | 'balanced' = 'balanced';
  if (bias > 0.3) {
    biasDirection = 'overestimating';
  } else if (bias < -0.3) {
    biasDirection = 'underestimating';
  }

  const absBias = Math.abs(bias);
  let level: 'High' | 'Moderate' | 'Slight' = 'High';
  if (absBias > 0.8) {
    level = 'Slight';
  } else if (absBias > 0.3) {
    level = 'Moderate';
  }

  const rawCalibrated = 0.5 * rawOea + 0.5 * normalizedAccuracy;
  const calibratedOeaScore = Math.max(1.0, Math.min(5.0, rawCalibrated));

  let notes = `High behavioral alignment between self-reported OEA (${rawOea.toFixed(2)}) and objective smile perception accuracy (${(accuracy * 100).toFixed(0)}%).`;
  if (level === 'Moderate') {
    notes = `Moderate alignment: self-reported OEA (${rawOea.toFixed(2)}) shows slight ${biasDirection} relative to facial micro-expression accuracy (${(accuracy * 100).toFixed(0)}%).`;
  } else if (level === 'Slight') {
    notes = `Low alignment: candidate is ${biasDirection} their emotional awareness capability (raw OEA ${rawOea.toFixed(2)} vs accuracy ${(accuracy * 100).toFixed(0)}%).`;
  }

  return {
    rawOea,
    calibratedOeaScore,
    accuracy,
    bias,
    biasDirection,
    level,
    notes,
  };
}

export function scoreSmileTask(answers: SmileAnswer[], trials: SmileTrialConfig[], rawOea: number): SmileScoringResult {
  const validated = validateSmileAnswers(answers, trials);
  const trialMap = new Map(trials.map((t) => [t.trialId, t]));

  let correctCount = 0;
  const scoredAnswers = validated.map((ans) => {
    const trial = trialMap.get(ans.trialId)!;
    const correct = ans.perceived === trial.groundTruth;
    if (correct) correctCount += 1;

    return {
      trialId: ans.trialId,
      perceived: ans.perceived,
      correct,
      rtMs: ans.rtMs,
    };
  });

  const total = trials.length;
  const accuracy = total > 0 ? correctCount / total : 0;
  const calibration = calibrateWLEIS(rawOea, accuracy);

  return {
    score: correctCount,
    total,
    accuracy,
    answers: scoredAnswers,
    calibration,
  };
}
