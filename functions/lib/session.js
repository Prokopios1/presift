"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSession = resolveSession;
exports.buildSessionKeys = buildSessionKeys;
function resolveSession(assessmentId, bank, rng) {
    if (!assessmentId)
        throw new Error("Missing assessmentId");
    if (!bank || !bank.cognitive || !bank.cognitive.items || bank.cognitive.items.length === 0) {
        throw new Error("Invalid or empty bank");
    }
    const random = rng || Math.random;
    const keys = [];
    const items = bank.cognitive.items.map(item => {
        let resolvedPrompt = item.resolvedExample.prompt;
        let resolvedOptions = [...item.resolvedExample.options];
        if (item.promptTemplate && item.optionTemplates && item.parameterization) {
            let unique = false;
            let attempts = 0;
            while (!unique && attempts < 100) {
                attempts++;
                const vars = {};
                let validVariables = true;
                for (const rule of item.parameterization.rules) {
                    if (rule.type === 'integer') {
                        if (rule.range) {
                            const min = rule.range[0];
                            const max = rule.range[1];
                            vars[rule.variable] = Math.floor(random() * (max - min + 1)) + min;
                        }
                        else if (rule.enum) {
                            const index = Math.floor(random() * rule.enum.length);
                            vars[rule.variable] = rule.enum[index];
                        }
                        // Very simple constraint check (if constraint exists)
                        if (rule.constraint) {
                            // Only handling the specific constraint for ICAR-N-01 as a hack, or using Function
                            try {
                                const constraintFn = new Function(...Object.keys(vars), `return ${rule.constraint};`);
                                if (!constraintFn(...Object.values(vars))) {
                                    validVariables = false;
                                    break;
                                }
                            }
                            catch {
                                // ignore
                            }
                        }
                    }
                }
                if (!validVariables)
                    continue;
                try {
                    const evalExpr = (expr) => {
                        const cleanExpr = expr.replace(/{{|}}/g, '');
                        const fn = new Function(...Object.keys(vars), `return ${cleanExpr};`);
                        return String(fn(...Object.values(vars)));
                    };
                    const newPrompt = item.promptTemplate.replace(/{{[^}]+}}/g, (match) => evalExpr(match));
                    const newOptions = item.optionTemplates.map((opt) => evalExpr(opt));
                    const allDistinct = new Set(newOptions).size === newOptions.length;
                    const allPositive = newOptions.every((opt) => !opt.startsWith('-'));
                    if (allDistinct && allPositive) {
                        unique = true;
                        resolvedPrompt = newPrompt;
                        resolvedOptions = newOptions;
                    }
                }
                catch {
                    // fallback to resolvedExample if parameterization fails
                    break;
                }
            }
        }
        const correctString = resolvedOptions[item.correctIndex || 0];
        const options = [...resolvedOptions];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        const newCorrectIndex = options.indexOf(correctString);
        keys.push({
            itemId: item.id,
            correctIndex: newCorrectIndex,
            irt: item.irt
        });
        return {
            itemId: item.id,
            domain: item.domain,
            prompt: resolvedPrompt,
            options
        };
    });
    const wleisItems = bank.wleis.items.map(item => ({
        itemId: item.id,
        domain: 'wleis',
        prompt: item.item,
        options: ['1', '2', '3', '4', '5', '6', '7']
    }));
    // (To avoid modifying resolveSession's return type heavily, we'll attach a non-enumerable property or just return it in a parallel array)
    // Let's modify resolveSession to return `keys` alongside items
    const sessionId = `${assessmentId}_sess_${Math.random().toString(36).substring(2, 9)}`;
    return { sessionId, items, wleisItems, keys };
}
function buildSessionKeys(session, bank, _rng) {
    const keys = [];
    if (session.keys) {
        return session.keys;
    }
    // Fallback for tests that don't pass _keys
    for (const sessionItem of session.items) {
        if (sessionItem.domain === 'wleis') {
            continue; // WLEIS scored separately via transformLikert
        }
        const bankItem = bank.cognitive.items.find(i => i.id === sessionItem.itemId);
        if (!bankItem) {
            throw new Error(`Item ${sessionItem.itemId} not found in bank.`);
        }
        const correctString = bankItem.resolvedExample.options[bankItem.resolvedExample.correctIndex];
        const newCorrectIndex = sessionItem.options.indexOf(correctString);
        if (newCorrectIndex === -1) {
            throw new Error(`Correct option not found in shuffled options for item ${sessionItem.itemId}`);
        }
        keys.push({
            itemId: bankItem.id,
            correctIndex: newCorrectIndex,
            irt: bankItem.irt
        });
    }
    return keys;
}
//# sourceMappingURL=session.js.map