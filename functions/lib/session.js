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
/**
 * Pick `n` distinct entries from `pool` using the session RNG (Fisher–Yates-ish
 * incremental draw). Returns null when the pool is too small.
 */
function sampleDistinct(pool, n, random) {
    if (pool.length < n)
        return null;
    const copy = [...pool];
    const picked = [];
    while (picked.length < n && copy.length > 0) {
        const i = Math.floor(random() * copy.length);
        picked.push(copy.splice(i, 1)[0]);
    }
    return picked.length === n ? picked : null;
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
        let defaultCorrectIndex;
        if (item.promptTemplate && item.optionTemplates && item.parameterization) {
            let unique = false;
            let attempts = 0;
            const rules = (item.parameterization.rules || []);
            while (!unique && attempts < 100) {
                attempts++;
                const vars = {};
                // Per-language literal substitutions coming from bank-sourced rules.
                const strVars = { en: {}, el: {} };
                const handled = new Set();
                let bankCorrectIndex;
                let validVariables = true;
                // Resolve a rule's `source` (e.g. "banks.analogyPairs") to its bilingual
                // list. `en` and `el` are positionally aligned, so one drawn index gives
                // the same word slot in both languages.
                const bankLists = bank.banks || {};
                const listFor = (source) => {
                    const m = /^banks\.(\w+)$/.exec(String(source || ''));
                    if (!m)
                        return null;
                    const l = bankLists[m[1]];
                    return l && Array.isArray(l.en) && Array.isArray(l.el) ? l : null;
                };
                for (const rule of rules) {
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
                        continue;
                    }
                    // --- Bank-sourced (verbal) rules ---
                    if (rule.variable === 'distractors' && !listFor(rule.source)) {
                        // V-02/V-03 draw distractors from the selected set itself (handled below).
                        continue;
                    }
                    const list = listFor(rule.source);
                    if (!list)
                        continue;
                    const idx = Math.floor(random() * list.en.length);
                    const enEntry = list.en[idx];
                    const elEntry = list.el[idx];
                    if (!Array.isArray(enEntry) || !Array.isArray(elEntry))
                        continue;
                    if (rule.variable === 'analogyPair') {
                        ['X', 'Y', 'P', 'Q'].forEach((k, i) => {
                            strVars.en[k] = String(enEntry[i]);
                            strVars.el[k] = String(elEntry[i]);
                        });
                    }
                    else if (rule.variable === 'synonymSet' || rule.variable === 'antonymSet') {
                        const correctKey = rule.variable === 'synonymSet' ? 'SYN' : 'ANT';
                        strVars.en.TARGET = String(enEntry[0]);
                        strVars.el.TARGET = String(elEntry[0]);
                        strVars.en[correctKey] = String(enEntry[1]);
                        strVars.el[correctKey] = String(elEntry[1]);
                        const dPool = enEntry.slice(2).map((w, i) => ({ en: String(w), el: String(elEntry[i + 2]) }));
                        const pickedD = sampleDistinct(dPool, 3, random);
                        if (!pickedD) {
                            validVariables = false;
                            break;
                        }
                        pickedD.forEach((p, i) => {
                            strVars.en['D' + (i + 1)] = p.en;
                            strVars.el['D' + (i + 1)] = p.el;
                        });
                        handled.add('distractors');
                    }
                    else if (rule.variable === 'oddOneOutSet') {
                        ['W1', 'W2', 'W3', 'W4'].forEach((k, i) => {
                            strVars.en[k] = String(enEntry[i]);
                            strVars.el[k] = String(elEntry[i]);
                        });
                        const odd = Number(enEntry[4]);
                        if (Number.isInteger(odd) && odd >= 0 && odd <= 3)
                            bankCorrectIndex = odd;
                    }
                }
                // Shared distractor pool (analogy items): 3 distinct, never equal to Q.
                if (validVariables && !handled.has('distractors')) {
                    for (const rule of rules) {
                        if (rule.variable !== 'distractors')
                            continue;
                        const pool = listFor(rule.source);
                        if (!pool)
                            continue;
                        const options = pool.en.map((w, i) => ({ en: String(w), el: String(pool.el[i]) }));
                        const excludeQ = (strVars.en.Q || '').toLowerCase();
                        const picked = sampleDistinct(options.filter(o => o.en.toLowerCase() !== excludeQ), 3, random);
                        if (!picked) {
                            validVariables = false;
                            break;
                        }
                        picked.forEach((p, i) => {
                            strVars.en['D' + (i + 1)] = p.en;
                            strVars.el['D' + (i + 1)] = p.el;
                        });
                        handled.add('distractors');
                    }
                }
                if (!validVariables)
                    continue;
                try {
                    const evalExpr = (expr, lang) => {
                        const cleanExpr = expr.replace(/{{|}}/g, '');
                        // Bank-sourced literal (verbal vocabulary) takes precedence.
                        if (strVars[lang][cleanExpr] !== undefined)
                            return strVars[lang][cleanExpr];
                        // Plain numeric variable (e.g. {{W1}}).
                        if (vars[cleanExpr] !== undefined && !/[+\-*/^]/.test(cleanExpr)) {
                            return String(vars[cleanExpr]);
                        }
                        // Arithmetic over the sampled numeric variables (e.g. {{a+d}}).
                        const fn = new Function(...Object.keys(vars), `return ${cleanExpr};`);
                        return String(fn(...Object.values(vars)));
                    };
                    const newPromptEn = item.promptTemplate.en.replace(/{{[^}]+}}/g, (match) => evalExpr(match, 'en'));
                    const newPromptEl = item.promptTemplate.el.replace(/{{[^}]+}}/g, (match) => evalExpr(match, 'el'));
                    const newOptionsEn = item.optionTemplates.en.map((opt) => evalExpr(opt, 'en'));
                    const newOptionsEl = item.optionTemplates.el.map((opt) => evalExpr(opt, 'el'));
                    const allDistinct = new Set(newOptionsEn).size === newOptionsEn.length &&
                        new Set(newOptionsEl).size === newOptionsEl.length;
                    const allPositive = newOptionsEn.every((opt) => !opt.startsWith('-'));
                    const noPlaceholders = !/{{/.test(newPromptEn + newPromptEl + newOptionsEn.join('|') + newOptionsEl.join('|'));
                    if (allDistinct && allPositive && noPlaceholders) {
                        unique = true;
                        resolvedPrompt = { en: newPromptEn, el: newPromptEl };
                        resolvedOptionsEn = newOptionsEn;
                        resolvedOptionsEl = newOptionsEl;
                        if (bankCorrectIndex !== undefined)
                            defaultCorrectIndex = bankCorrectIndex;
                    }
                }
                catch {
                    // fallback to resolvedExample if parameterization fails
                    break;
                }
            }
        }
        const correctIndex = defaultCorrectIndex !== undefined ? defaultCorrectIndex : (item.correctIndex || 0);
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