"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsychometricError = void 0;
exports.transformLikert = transformLikert;
exports.estimateTheta = estimateTheta;
exports.mapToScale = mapToScale;
exports.scoreWleis = scoreWleis;
exports.evaluateCandidate = evaluateCandidate;
class PsychometricError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PsychometricError';
    }
}
exports.PsychometricError = PsychometricError;
function transformLikert(value, reverse) {
    if (value < 1 || value > 5 || !Number.isInteger(value)) {
        throw new PsychometricError(`Invalid Likert value: ${value}. Must be integer between 1 and 5.`);
    }
    return reverse ? 6 - value : value;
}
// 3PL IRT probability
function calculateProb(theta, a, b, c) {
    const logit = a * (theta - b);
    return c + (1 - c) / (1 + Math.exp(-logit));
}
// Normal PDF for N(0,1) prior
function normalPdf(x) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2);
}
function estimateTheta(responseVector, params) {
    if (responseVector.length === 0) {
        throw new PsychometricError("Response vector cannot be empty.");
    }
    if (responseVector.length !== params.length) {
        throw new PsychometricError("Length mismatch between response vector and IRT parameters.");
    }
    for (const r of responseVector) {
        if (r !== 0 && r !== 1) {
            throw new PsychometricError(`Response vector must be binary, got ${r}.`);
        }
    }
    // EAP using numerical integration (81 quadrature points from -4 to 4)
    const nodes = [];
    for (let i = -4; i <= 4; i += 0.1) {
        nodes.push(i);
    }
    let numerator = 0;
    let denominator = 0;
    for (const theta of nodes) {
        let likelihood = 1;
        for (let i = 0; i < responseVector.length; i++) {
            const { a, b, c } = params[i];
            const p = calculateProb(theta, a, b, c);
            likelihood *= responseVector[i] === 1 ? p : (1 - p);
        }
        // Weight by prior N(0,1)
        const priorWeight = normalPdf(theta);
        const posterior = likelihood * priorWeight;
        numerator += theta * posterior;
        denominator += posterior;
    }
    if (denominator === 0) {
        throw new PsychometricError("Mathematical domain error: likelihood integrated to zero.");
    }
    return numerator / denominator;
}
function normalCdf(x) {
    let t = 1 / (1 + 0.2316419 * Math.abs(x));
    let d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0)
        prob = 1 - prob;
    return prob;
}
function mapToScale(theta) {
    const standardScore = Math.round(100 + 15 * theta);
    let percentile = Number((normalCdf(theta) * 100).toFixed(2));
    // Clamp (0.1, 99.9)
    percentile = Math.max(0.1, Math.min(99.9, percentile));
    return { standardScore, percentile };
}
function scoreWleis(answers) {
    const rawScores = { SEA: 0, OEA: 0, UOE: 0, ROE: 0, Total: 0 };
    for (const ans of answers) {
        if (!['SEA', 'OEA', 'UOE', 'ROE'].includes(ans.subscale)) {
            throw new PsychometricError(`Invalid subscale: ${ans.subscale}`);
        }
        const val = transformLikert(ans.value, ans.reverse);
        rawScores[ans.subscale] += val;
        rawScores.Total += val;
    }
    return rawScores;
}
function evaluateCandidate(responseVector, wleisAnswers, params) {
    const theta = estimateTheta(responseVector, params);
    const { standardScore, percentile } = mapToScale(theta);
    const rawScore = responseVector.reduce((sum, val) => sum + val, 0);
    const wleisScores = scoreWleis(wleisAnswers);
    return {
        icar: {
            rawScore,
            maxRawScore: responseVector.length,
            theta: Number(theta.toFixed(4)),
            standardScore,
            percentile
        },
        wleis: {
            rawScores: wleisScores
        }
    };
}
//# sourceMappingURL=psychometrics.js.map