"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionError = void 0;
exports.candidateDocId = candidateDocId;
exports.validateSubmission = validateSubmission;
exports.processSubmission = processSubmission;
const psychometrics_1 = require("./psychometrics");
const smile_1 = require("./smile");
class SubmissionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SubmissionError';
    }
}
exports.SubmissionError = SubmissionError;
function candidateDocId(sessionId) {
    if (!sessionId)
        throw new SubmissionError('ERR_MISSING_SESSION_ID');
    return 'cand_' + sessionId;
}
function validateSubmission(payload, bank) {
    if (!payload || typeof payload !== 'object')
        throw new SubmissionError('ERR_INVALID_PAYLOAD');
    if (!payload.sessionId)
        throw new SubmissionError('ERR_MISSING_SESSION_ID');
    if (!Array.isArray(payload.icar) || payload.icar.length !== bank.cognitive.items.length)
        throw new SubmissionError('ERR_INVALID_ICAR_ARRAY');
    if (!Array.isArray(payload.wleis) || payload.wleis.length !== bank.wleis.items.length)
        throw new SubmissionError('ERR_INVALID_WLEIS_ARRAY');
    const icarIds = new Set();
    const normalizedIcar = [];
    for (const item of payload.icar) {
        if ('correctAnswerKey' in item || 'correctIndex' in item || 'irt' in item || 'difficulty' in item || 'parameterization' in item) {
            throw new SubmissionError('ERR_FORBIDDEN_KEY');
        }
        const bankItem = bank.cognitive.items.find(i => i.id === item.itemId);
        if (!bankItem)
            throw new SubmissionError(`ERR_UNKNOWN_ICAR_ITEM`);
        if (icarIds.has(item.itemId))
            throw new SubmissionError(`ERR_DUPLICATE_ICAR_ITEM`);
        icarIds.add(item.itemId);
        if (item.selectedIndex !== null && (!Number.isInteger(item.selectedIndex) || item.selectedIndex < 0 || item.selectedIndex > 3)) {
            throw new SubmissionError(`ERR_INVALID_SELECTED_INDEX`);
        }
        normalizedIcar.push({ itemId: item.itemId, selectedIndex: item.selectedIndex });
    }
    const wleisIds = new Set();
    const normalizedWleis = [];
    for (const item of payload.wleis) {
        if ('correctAnswerKey' in item || 'correctIndex' in item || 'irt' in item || 'difficulty' in item || 'parameterization' in item) {
            throw new SubmissionError('ERR_FORBIDDEN_KEY');
        }
        const bankItem = bank.wleis.items.find(i => i.id === item.itemId);
        if (!bankItem)
            throw new SubmissionError(`ERR_UNKNOWN_WLEIS_ITEM`);
        if (wleisIds.has(item.itemId))
            throw new SubmissionError(`ERR_DUPLICATE_WLEIS_ITEM`);
        wleisIds.add(item.itemId);
        if (item.value !== null && (!Number.isInteger(item.value) || item.value < 1 || item.value > 7)) {
            throw new SubmissionError(`ERR_INVALID_LIKERT_VALUE`);
        }
        normalizedWleis.push({
            itemId: item.itemId,
            value: item.value || 4, // default to neutral if null
            subscale: bankItem.subscale,
            reverse: bankItem.reverse
        });
    }
    let smileAnswers = undefined;
    const rawSmile = payload.smileAnswers || payload.smile;
    if (rawSmile !== undefined) {
        if (!Array.isArray(rawSmile))
            throw new SubmissionError('ERR_INVALID_SMILE_ARRAY');
        const smileTrials = (bank.smileTask?.trials || []).map((t) => ({
            trialId: t.trialId,
            start: t.start,
            end: t.end,
            groundTruth: (t.groundTruth === 'fake' ? 'fake' : 'genuine'),
        }));
        smileAnswers = (0, smile_1.validateSmileAnswers)(rawSmile, smileTrials);
    }
    return {
        sessionId: payload.sessionId,
        icar: normalizedIcar,
        wleis: normalizedWleis,
        ...(smileAnswers !== undefined ? { smileAnswers } : {}),
    };
}
function processSubmission(submission, sessionKeys) {
    if (submission.answers.length !== sessionKeys.length) {
        throw new SubmissionError("ERR_LENGTH_MISMATCH");
    }
    const responseVector = [];
    const irtParams = [];
    for (const sessionKey of sessionKeys) {
        const submittedAnswer = submission.answers.find(a => a.itemId === sessionKey.itemId);
        if (!submittedAnswer) {
            throw new SubmissionError(`ERR_MISSING_ANSWER`);
        }
        const isCorrect = submittedAnswer.selectedIndex === sessionKey.correctIndex ? 1 : 0;
        responseVector.push(isCorrect);
        irtParams.push(sessionKey.irt);
    }
    return (0, psychometrics_1.evaluateCandidate)(responseVector, submission.wleisAnswers, irtParams);
}
//# sourceMappingURL=submission.js.map