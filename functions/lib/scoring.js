"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCandidate = evaluateCandidate;
/**
 * Standard Normal Cumulative Distribution Function
 */
function normalCDF(x) {
    let t = 1 / (1 + 0.2316419 * Math.abs(x));
    let d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0)
        prob = 1 - prob;
    return prob;
}
/**
 * Maximum Likelihood Estimation (MLE) using Newton-Raphson to find Theta
 */
function estimateTheta(items, rawScore, maxIter = 20, tolerance = 0.001) {
    if (rawScore === 0)
        return -4.0; // Prevent infinite negative theta
    if (rawScore === items.length)
        return 4.0; // Prevent infinite positive theta
    let theta = 0.0; // Initial guess
    for (let i = 0; i < maxIter; i++) {
        let expectedScore = 0;
        let information = 0;
        for (const item of items) {
            const a = item.discrimination || 1.0;
            const b = item.difficultyCoefficient;
            const logit = a * (theta - b);
            const prob = 1 / (1 + Math.exp(-logit));
            expectedScore += prob;
            information += a * a * prob * (1 - prob); // 1st derivative of expected score w.r.t theta
        }
        const difference = rawScore - expectedScore;
        if (Math.abs(difference) < tolerance)
            break;
        // Newton-Raphson update
        theta = theta + (difference / information);
    }
    // Bound theta to reasonable psychometric limits [-4.0, 4.0]
    return Math.max(-4.0, Math.min(4.0, theta));
}
/**
 * Main Evaluation Function
 */
function evaluateCandidate(responses) {
    // 1. Evaluate WLEIS-16 Emotional Intelligence
    const eiScores = { SEA: 0, OEA: 0, UOE: 0, ROE: 0, Total: 0 };
    for (const item of responses.wleis) {
        // Apply explicit reverse-scoring for 1-7 Likert scale
        const score = item.reverseScored ? (8 - item.response) : item.response;
        eiScores[item.subscale] += score;
        eiScores.Total += score;
    }
    // 2. Evaluate ICAR-16 Cognitive Items
    let icarRaw = 0;
    for (const item of responses.icar) {
        if (item.response === item.correctAnswerKey) {
            icarRaw += 1;
        }
    }
    // Compute Candidate's Theta using IRT (1PL/2PL model)
    const theta = estimateTheta(responses.icar, icarRaw);
    // Map theta to Standard Score (Mean = 100, SD = 15)
    // Assuming theta is roughly a standard normal variable N(0,1) for the norm group
    const standardScore = Math.round(100 + (theta * 15));
    // Map theta to 0-100 Percentile
    const percentile = Number((normalCDF(theta) * 100).toFixed(2));
    return {
        icar: {
            rawScore: icarRaw,
            maxRawScore: responses.icar.length,
            theta: Number(theta.toFixed(4)),
            standardScore,
            percentile
        },
        wleis: {
            rawScores: eiScores
        }
    };
}
//# sourceMappingURL=scoring.js.map