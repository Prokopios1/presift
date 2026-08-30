import { ScoringResult, WleisAnswer, evaluateCandidate } from './psychometrics';
import { SessionKey, ItemBank } from './session';
import { SmileAnswer, validateSmileAnswers, SmileTrialConfig } from './smile';

export interface AssessmentSubmission {
  sessionId: string;
  answers: {
    itemId: string;
    selectedIndex: number | null;
  }[];
  wleisAnswers: WleisAnswer[];
  smileAnswers?: SmileAnswer[];
}

export class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubmissionError';
  }
}

export function candidateDocId(sessionId: string): string {
  if (!sessionId) throw new SubmissionError('Missing sessionId');
  return 'cand_' + sessionId;
}

export function validateSubmission(payload: any, bank: ItemBank) {
  if (!payload || typeof payload !== 'object') throw new SubmissionError('Invalid payload');
  if (!payload.sessionId) throw new SubmissionError('Missing sessionId');

  if (!Array.isArray(payload.icar) || payload.icar.length !== bank.cognitive.items.length) throw new SubmissionError('Invalid icar array');
  if (!Array.isArray(payload.wleis) || payload.wleis.length !== bank.wleis.items.length) throw new SubmissionError('Invalid wleis array');

  const icarIds = new Set<string>();
  const normalizedIcar: { itemId: string; selectedIndex: number | null }[] = [];
  for (const item of payload.icar) {
    if ('correctAnswerKey' in item || 'correctIndex' in item || 'irt' in item || 'difficulty' in item || 'parameterization' in item) {
      throw new SubmissionError('forbidden key');
    }
    const bankItem = bank.cognitive.items.find(i => i.id === item.itemId);
    if (!bankItem) throw new SubmissionError(`Unknown icar item ${item.itemId}`);
    if (icarIds.has(item.itemId)) throw new SubmissionError(`Duplicate icar item ${item.itemId}`);
    icarIds.add(item.itemId);
    if (item.selectedIndex !== null && (!Number.isInteger(item.selectedIndex) || item.selectedIndex < 0 || item.selectedIndex > 3)) {
      throw new SubmissionError(`Invalid selectedIndex for ${item.itemId}`);
    }
    normalizedIcar.push({ itemId: item.itemId, selectedIndex: item.selectedIndex });
  }

  const wleisIds = new Set<string>();
  const normalizedWleis: WleisAnswer[] = [];
  for (const item of payload.wleis) {
    if ('correctAnswerKey' in item || 'correctIndex' in item || 'irt' in item || 'difficulty' in item || 'parameterization' in item) {
      throw new SubmissionError('forbidden key');
    }
    const bankItem = bank.wleis.items.find(i => i.id === item.itemId);
    if (!bankItem) throw new SubmissionError(`Unknown wleis item ${item.itemId}`);
    if (wleisIds.has(item.itemId)) throw new SubmissionError(`Duplicate wleis item ${item.itemId}`);
    wleisIds.add(item.itemId);
    if (item.value !== null && (!Number.isInteger(item.value) || item.value < 1 || item.value > 7)) {
      throw new SubmissionError(`Invalid likert value for ${item.itemId}`);
    }
    normalizedWleis.push({
      itemId: item.itemId,
      value: item.value || 4, // default to neutral if null
      subscale: bankItem.subscale as 'SEA' | 'OEA' | 'UOE' | 'ROE',
      reverse: bankItem.reverse
    });
  }

  let smileAnswers: SmileAnswer[] | undefined = undefined;
  const rawSmile = payload.smileAnswers || payload.smile;
  if (rawSmile !== undefined) {
    if (!Array.isArray(rawSmile)) throw new SubmissionError('Invalid smileAnswers array');
    const smileTrials: SmileTrialConfig[] = (bank.smileTask?.trials || []).map((t: any) => ({
      trialId: t.trialId,
      start: t.start,
      end: t.end,
      groundTruth: (t.groundTruth === 'fake' ? 'fake' : 'genuine') as 'genuine' | 'fake',
    }));
    smileAnswers = validateSmileAnswers(rawSmile, smileTrials);
  }

  return {
    sessionId: payload.sessionId,
    icar: normalizedIcar,
    wleis: normalizedWleis,
    ...(smileAnswers !== undefined ? { smileAnswers } : {}),
  };
}

export function processSubmission(submission: AssessmentSubmission, sessionKeys: SessionKey[]): ScoringResult {
  if (submission.answers.length !== sessionKeys.length) {
    throw new SubmissionError("Length mismatch between submitted answers and session keys.");
  }

  const responseVector: number[] = [];
  const irtParams = [];

  for (const sessionKey of sessionKeys) {
    const submittedAnswer = submission.answers.find(a => a.itemId === sessionKey.itemId);
    if (!submittedAnswer) {
      throw new SubmissionError(`Missing answer for item: ${sessionKey.itemId}`);
    }

    const isCorrect = submittedAnswer.selectedIndex === sessionKey.correctIndex ? 1 : 0;
    responseVector.push(isCorrect);
    irtParams.push(sessionKey.irt);
  }

  return evaluateCandidate(responseVector, submission.wleisAnswers, irtParams);
}
