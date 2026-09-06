"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localizeSession = localizeSession;
exports.resolveSession = resolveSession;
exports.buildSessionKeys = buildSessionKeys;
/**
 * Single-language view of a resolved session. Consumes the bilingual output of
 * resolveSession (items[].prompt/options carry {en, el}) and collapses each to
 * the requested language's plain string. Language-neutral options (numeric ICAR
 * options, Likert 1-7 labels) are identical in both languages and pass through
 * unchanged. PURE helper — does not touch sessions or the bank.
 */
function localizeSession(session, lang = 'el') {
    const pick = (b) => (lang === 'en' ? b.en : b.el);
    const localize = (item) => ({
        itemId: item.itemId,
        domain: item.domain,
        prompt: pick(item.prompt),
        options: item.options.map(o => pick(o)),
    });
    return {
        items: session.items.map(localize),
        wleisItems: session.wleisItems.map(localize),
    };
}
function resolveSession(assessmentId, bank, rng) {
    if (!assessmentId)
        throw new Error("ERR_MISSING_ASSESSMENT_ID");
    if (!bank || !bank.cognitive || !bank.cognitive.items || bank.cognitive.items.length === 0) {
        throw new Error("ERR_INVALID_BANK");
    }
    const random = rng || Math.random;
    const keys = [];
    const items = bank.cognitive.items.map(item => {
        let resolvedPrompt = { ...item.resolvedExample.prompt };
        let resolvedOptionsEn = [...item.resolvedExample.options.en];
        let resolvedOptionsEl = [...item.resolvedExample.options.el];
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
                        if (rule.constraint) {
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
                        // For simple variables without math (e.g. {{W1}})
                        if (vars[cleanExpr] !== undefined && !/[+\-*/^]/.test(cleanExpr)) {
                            return String(vars[cleanExpr]);
                        }
                        // For math expressions, eval them
                        // We must skip evaluation if it's not actually math but a string from verbal, 
                        // but the variables from range/enum are numbers, so it's fine.
                        // Wait, for Verbal, vars might be string? 
                        // In presift-bank, verbal uses rules with sources, not just integers.
                        // But the rule.type is not integer for verbal! So vars won't have them in this loop?
                        // Wait, the parameterization in verbal items does not have type='integer'. 
                        // If they are not integers, how are they handled? The original code didn't handle them! 
                        // Wait, look at the original code: 
                        // for (const rule of item.parameterization.rules) { if (rule.type === 'integer') { ... } }
                        // Verbal items don't have type: 'integer'. The original code just ignored them and fell back to resolvedExample!
                        const fn = new Function(...Object.keys(vars), `return ${cleanExpr};`);
                        return String(fn(...Object.values(vars)));
                    };
                    const newPromptEn = item.promptTemplate.en.replace(/{{[^}]+}}/g, (match) => evalExpr(match));
                    const newPromptEl = item.promptTemplate.el.replace(/{{[^}]+}}/g, (match) => evalExpr(match));
                    const newOptionsEn = item.optionTemplates.en.map((opt) => evalExpr(opt));
                    const newOptionsEl = item.optionTemplates.el.map((opt) => evalExpr(opt));
                    const allDistinct = new Set(newOptionsEn).size === newOptionsEn.length;
                    const allPositive = newOptionsEn.every((opt) => !opt.startsWith('-'));
                    if (allDistinct && allPositive) {
                        unique = true;
                        resolvedPrompt = { en: newPromptEn, el: newPromptEl };
                        resolvedOptionsEn = newOptionsEn;
                        resolvedOptionsEl = newOptionsEl;
                    }
                }
                catch {
                    // fallback to resolvedExample if parameterization fails
                    break;
                }
            }
        }
        const correctIndex = item.correctIndex || 0;
        // Combine into objects before shuffle
        let combinedOptions = resolvedOptionsEn.map((enStr, i) => ({
            en: enStr,
            el: resolvedOptionsEl[i],
            isCorrect: i === correctIndex
        }));
        for (let i = combinedOptions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [combinedOptions[i], combinedOptions[j]] = [combinedOptions[j], combinedOptions[i]];
        }
        const newCorrectIndex = combinedOptions.findIndex(o => o.isCorrect);
        keys.push({
            itemId: item.id,
            correctIndex: newCorrectIndex,
            irt: item.irt
        });
        return {
            itemId: item.id,
            domain: item.domain,
            prompt: resolvedPrompt,
            options: combinedOptions.map(o => ({ en: o.en, el: o.el }))
        };
    });
    const wleisItems = bank.wleis.items.map(item => ({
        itemId: item.id,
        domain: 'wleis',
        prompt: item.item,
        options: ['1', '2', '3', '4', '5', '6', '7'].map(num => ({ en: num, el: num }))
    }));
    const smileTask = bank.smileTask
        ? {
            videoId: bank.smileTask.videoId,
            videoUrl: bank.smileTask.videoUrl,
            totalTrials: bank.smileTask.totalTrials || bank.smileTask.trials?.length || 20,
            trials: (bank.smileTask.trials || []).map(t => ({
                trialId: t.trialId,
                start: t.start,
                end: t.end
            }))
        }
        : undefined;
    const sessionId = `${assessmentId}_sess_${Math.random().toString(36).substring(2, 9)}`;
    return { sessionId, items, wleisItems, keys, smileTask };
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
            throw new Error(`ERR_UNKNOWN_ITEM`);
        }
        const correctStringEn = bankItem.resolvedExample.options.en[bankItem.resolvedExample.correctIndex];
        const newCorrectIndex = sessionItem.options.findIndex(o => o.en === correctStringEn);
        if (newCorrectIndex === -1) {
            throw new Error(`ERR_CORRECT_OPTION_NOT_FOUND`);
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