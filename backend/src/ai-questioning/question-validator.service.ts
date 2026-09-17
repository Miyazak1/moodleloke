import { Injectable } from '@nestjs/common';
import { GeneratedQuestionCandidate, ReviewContext, ReviewDimension, ReviewResult, ValidationIssue } from './ai-questioning.types';

function text(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hasDuplicateOptionText(options: GeneratedQuestionCandidate['options']) {
  const values = options.map((option) => text(option.text).toLowerCase()).filter(Boolean);
  return new Set(values).size !== values.length;
}

function looseOptionSignature(value: string) {
  return text(value)
    .toLowerCase()
    .replace(/\b(option|answer|choice)\b/g, '')
    .replace(/[（）(){}'"\s,.;:，。；：]+/g, '')
    .replace(/[−－]/g, '-')
    .replace(/[＝]/g, '=')
    .trim();
}

function hasEquivalentOptionText(options: GeneratedQuestionCandidate['options']) {
  const values = options.map((option) => looseOptionSignature(option.text)).filter(Boolean);
  return new Set(values).size !== values.length;
}

function subscriptDigitsToAscii(value: string) {
  const digits = '₀₁₂₃₄₅₆₇₈₉';
  return Array.from(value).map((character) => {
    const index = digits.indexOf(character);
    return index >= 0 ? String(index) : character;
  }).join('');
}

function simpleLogarithmTrueDistractor(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt)
    .replace(/[−－]/g, '-')
    .replace(/[＋]/g, '+');
  const match = prompt.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*log(?:_?\{?([0-9]+(?:\.[0-9]+)?)\}?|([₀₁₂₃₄₅₆₇₈₉]+))\s*[（(]\s*x\s*([+-])\s*([0-9]+(?:\.[0-9]+)?)\s*[)）]/i);
  if (!match) return null;
  const base = Number(match[1] || subscriptDigitsToAscii(match[2] || ''));
  const offset = Number(match[4]) * (match[3] === '-' ? -1 : 1);
  if (!Number.isFinite(base) || base <= 0 || sameNumber(base, 1) || !Number.isFinite(offset)) return null;
  for (const option of candidate.options) {
    if (option.id === candidate.correctAnswer) continue;
    const optionMatch = text(option.text).replace(/[−－]/g, '-').match(/^f\s*\(\s*([+-]?[0-9]+(?:\.[0-9]+)?)\s*\)\s*=\s*([+-]?[0-9]+(?:\.[0-9]+)?)$/i);
    if (!optionMatch) continue;
    const input = Number(optionMatch[1]);
    const declared = Number(optionMatch[2]);
    const argument = input + offset;
    if (argument <= 0) continue;
    const actual = Math.log(argument) / Math.log(base);
    if (Number.isFinite(actual) && sameNumber(actual, declared)) return option.id;
  }
  return null;
}

function isGenericDistractorText(value: string) {
  const normalized = text(value).toLowerCase();
  return /^(not sure|unknown|irrelevant|wrong answer|distractor|cannot determine|none|n\/a)$/i.test(normalized)
    || /^(无法确定|不知道|无关|错误答案|干扰项|以上都不是)$/.test(normalized);
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.allowed)) return asArray(record.allowed);
    if (Array.isArray(record.values)) return asArray(record.values);
  }
  return [];
}

function difficultyKey(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (['basic', 'easy', 'foundation', '基础', '入门', 'l1'].includes(normalized)) return 'basic';
  if (['medium', 'normal', 'intermediate', '中等', '中级', '考频中', 'l2'].includes(normalized)) return 'medium';
  if (['hard', 'advanced', 'difficult', '较难', '提高', '挑战', '高级', 'l3'].includes(normalized)) return 'hard';
  return normalized;
}

function containsNeedle(haystack: string, needle: string) {
  const normalizedHaystack = text(haystack).toLowerCase();
  const normalizedNeedle = text(needle).toLowerCase();
  const looseHaystack = normalizedHaystack.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  const looseNeedle = normalizedNeedle.replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
  return Boolean(normalizedNeedle) && (normalizedHaystack.includes(normalizedNeedle) || (Boolean(looseNeedle) && looseHaystack.includes(looseNeedle)));
}

function syllabusSignalTerms(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return [];
  const asciiStopwords = new Set([
    'and',
    'the',
    'for',
    'with',
    'within',
    'from',
    'into',
    'this',
    'that',
    'exam',
    'scope',
    'csca',
    'topic',
    'question',
    'questions',
    'evaluate',
    'interpret',
    'apply',
    'application'
  ]);
  const cjkTerms = normalized
    .replace(/[的与和及、，,；;：:（）()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => /[\u4e00-\u9fff]/.test(item) && item.length >= 2)
    .filter((item) => !['基本', '性质', '概念', '方法', '应用', '问题'].includes(item));
  const asciiTerms = (normalized.match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [])
    .filter((item) => !asciiStopwords.has(item));
  return Array.from(new Set([...cjkTerms, ...asciiTerms]));
}

function containsSyllabusSignal(haystack: string, signal: string) {
  if (containsNeedle(haystack, signal)) return true;
  return syllabusSignalTerms(signal).some((term) => containsNeedle(haystack, term));
}

function tokenSet(value: string) {
  const normalized = text(value).toLowerCase();
  const asciiTokens = normalized.match(/[a-z0-9]+/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]/g) ?? [];
  return new Set([...asciiTokens, ...cjkTokens].filter((item) => item.length > 1 || /[\u4e00-\u9fff]/.test(item)));
}

function jaccardSimilarity(first: Set<string>, second: Set<string>) {
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const item of first) {
    if (second.has(item)) intersection += 1;
  }
  return intersection / (first.size + second.size - intersection);
}

function nearDuplicatePromptCount(prompt: string, existingPrompts: string[]) {
  const source = tokenSet(prompt);
  return existingPrompts.filter((existing) => {
    const normalizedPrompt = text(prompt).toLowerCase();
    const normalizedExisting = text(existing).toLowerCase();
    if (!normalizedPrompt || !normalizedExisting) return false;
    if (normalizedPrompt === normalizedExisting) return true;
    if (normalizedPrompt.length >= 24 && normalizedExisting.includes(normalizedPrompt)) return true;
    if (normalizedExisting.length >= 24 && normalizedPrompt.includes(normalizedExisting)) return true;
    return jaccardSimilarity(source, tokenSet(existing)) >= 0.82;
  }).length;
}

function hasPromptLeakage(candidate: GeneratedQuestionCandidate) {
  const body = [
    candidate.prompt,
    ...candidate.options.map((option) => option.text)
  ].join(' ');
  return /\b(correct answer|answer is|option [a-d] is correct|ai-generated|generated by ai|placeholder|todo|lorem ipsum)\b/i.test(body)
    || /\{\{[^}]+\}\}|\[[A-Z_]{3,}\]/.test(body);
}

function hasSelfCorrectingOrUncertainExplanation(candidate: GeneratedQuestionCandidate) {
  const explanation = text(candidate.explanation);
  return /[?？]\s*(?:实际|其实|但|不过|然而|可是|只是|although|but|however|actually)/i.test(explanation)
    || /(?:不确定|无法确定|可能有误|有待确认|待确认|存疑|不严谨|maybe|not sure|uncertain|needs confirmation)/i.test(explanation);
}

function hasUnbackedVisualReference(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  return /如图(?:所示)?|图中|下图|上图|shown in (?:the )?(?:figure|diagram)|as shown|shown below|(?:figure|diagram) below/i.test(prompt);
}

function correctOptionText(candidate: GeneratedQuestionCandidate) {
  return candidate.options.find((option) => option.id === candidate.correctAnswer)?.text ?? '';
}

function declaredAnswerInExplanation(explanation: string) {
  const normalized = text(explanation);
  const patterns = [
    /\b(?:correct\s+answer|answer)\s+(?:is|:)?\s*([A-D])\b/i,
    /(?:正确答案|答案)\s*(?:是|为|:|：)?\s*([A-D])/i,
    /(?:đáp\s+án\s+đúng|đáp\s+án)\s*(?:là|:)?\s*([A-D])/i
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function numericValue(value: string) {
  const source = text(value).replace(/[−－]/g, '-').trim();
  if (/^[（(]\s*[+-]?\d+(?:\.\d+)?\s*[,，]\s*[+-]?\d+(?:\.\d+)?\s*[)）]$/.test(source)) return null;
  const normalized = source
    .replace(/[，,]/g, '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  const controlledChemistryPh = normalized.match(
    /^(?:所得溶液的\s*pH\s*为|The resulting solution has pH)\s*([0-9]+(?:\.[0-9]+)?)(?:\.)?$/i
  );
  if (controlledChemistryPh) return Number(controlledChemistryPh[1]);
  const fraction = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator !== 0) return Number(fraction[1]) / denominator;
  }
  return null;
}

function leadingNumericValue(value: string) {
  const direct = numericValue(value);
  if (direct !== null) return direct;
  const normalized = text(value).replace(/[−－]/g, '-').replace(/[，,]/g, '');
  const fraction = normalized.match(/([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator !== 0) return Number(fraction[1]) / denominator;
  }
  const leadingDecimal = normalized.match(/^(?:约|约为|大约|≈|≃|~)?\s*([+-]?\d+(?:\.\d+)?)/i);
  if (leadingDecimal) return Number(leadingDecimal[1]);
  const controlledPhysicsQuantity = normalized.match(
    /^(?:速度大小|加速度|末速度|位移|speed magnitude|acceleration|final velocity|displacement)\s*[：:]\s*([+-]?\d+(?:\.\d+)?)/i
  );
  return controlledPhysicsQuantity ? Number(controlledPhysicsQuantity[1]) : null;
}

function sameNumber(first: number, second: number) {
  return Math.abs(first - second) <= 1e-9;
}

function numericDistanceTolerance(value: number) {
  return Math.max(0.015, Math.abs(value) * 0.03);
}

function numericOptionValues(candidate: GeneratedQuestionCandidate) {
  return candidate.options
    .map((option) => {
      const rawValue = leadingNumericValue(option.text);
      if (rawValue === null) return null;
      const normalized = text(option.text);
      const value = /%|百分/.test(normalized) && Math.abs(rawValue) > 1 ? rawValue / 100 : rawValue;
      return { id: option.id, text: option.text, value };
    })
    .filter((item): item is { id: string; text: string; value: number } => item !== null && Number.isFinite(item.value));
}

function hasStrictNumericAnswerOptions(candidate: GeneratedQuestionCandidate) {
  const correctValue = numericValue(correctOptionText(candidate));
  if (correctValue === null || !Number.isFinite(correctValue)) return false;
  return candidate.options.filter((option) => numericValue(option.text) !== null).length >= 2;
}

function resultNumericValuesFromExplanation(explanation: string) {
  const normalized = text(explanation).replace(/[−－]/g, '-').replace(/[，,](?=\d{3}\b)/g, '');
  const tail = normalized.slice(Math.max(0, normalized.length - 520));
  const values: Array<{ index: number; value: number }> = [];
  const patterns = [
    /(?:≈|≃|≅|~=|约为|约等于|约|等于|为|得|可得|计算得|结果(?:是|为)?|therefore|hence|so|equals?|is)\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*[+-]?\d+(?:\.\d+)?)?)/gi,
    /=\s*([+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?)/g,
    /=\s*([+-]?\d+(?:\.\d+)?)(?!\s*(?:\^|\*\*))/g
  ];
  for (const pattern of patterns) {
    for (const match of tail.matchAll(pattern)) {
      const value = numericValue(match[1] ?? '');
      if (value !== null && Number.isFinite(value)) values.push({ index: match.index ?? 0, value });
    }
  }
  const ordered = values
    .sort((left, right) => left.index - right.index)
    .map((item) => Math.round(item.value * 1e9) / 1e9);
  return Array.from(new Set(ordered));
}

function answerExplanationNumericMismatch(candidate: GeneratedQuestionCandidate) {
  const symbolicEquationOptionCount = candidate.options.filter((option) => {
    const normalized = text(option.text).replace(/[＝]/g, '=');
    return normalized.includes('=') && /[A-Za-z]/.test(normalized);
  }).length;
  if (symbolicEquationOptionCount >= 2) return null;
  const optionValues = numericOptionValues(candidate);
  if (optionValues.length < 2) return null;
  const declared = optionValues.find((option) => option.id === candidate.correctAnswer);
  if (!declared) return null;
  const resultValues = resultNumericValuesFromExplanation(candidate.explanation);
  if (resultValues.some((resultValue) => sameNumber(resultValue, declared.value))) return null;
  for (const resultValue of resultValues) {
    const ranked = optionValues
      .map((option) => ({ ...option, distance: Math.abs(option.value - resultValue) }))
      .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
    const best = ranked[0];
    const declaredDistance = Math.abs(declared.value - resultValue);
    const tolerance = numericDistanceTolerance(resultValue);
    if (best && best.id !== declared.id && best.distance + tolerance < declaredDistance) {
      return {
        resultValue,
        declared,
        best
      };
    }
  }
  return null;
}

function requestedLinearFunctionEvaluationInput(prompt: string) {
  const patterns = [
    /(?:what\s+is|find|calculate|evaluate)[^?？。]*f\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)/i,
    /(?:求|计算|求出|确定)[^?？。]*f\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)(?:\s*的值)?/i,
    /f\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*(?:的值|值)?\s*(?:为|是|等于|是多少|\?|？)/i
  ];
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function inferLinearFunctionAnswer(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-');
  if (!hasStrictNumericAnswerOptions(candidate)) return null;
  if (/\bf\s*\(\s*x\s*\)\s*=\s*x\s*(?:\^|\*\*)|幂函数|指数函数/.test(prompt)) return null;
  const match = prompt.match(/f\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)?\s*\*?\s*x\s*([+-]\s*\d+(?:\.\d+)?)?/i)
    ?? prompt.match(/f\s*\(\s*x\s*\)\s*=\s*x\s*([+-]\s*\d+(?:\.\d+)?)?/i);
  const input = requestedLinearFunctionEvaluationInput(prompt);
  if (!match || input === null) return null;
  const coefficient = match[0].includes('=x') ? 1 : Number(match[1] ?? 1);
  const constant = Number(String(match[2] ?? 0).replace(/\s+/g, ''));
  if (![coefficient, constant, input].every(Number.isFinite)) return null;
  return coefficient * input + constant;
}

function inferArithmeticSequenceAnswer(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-');
  const firstTermMatch = prompt.match(/\b(?:a_?1|first\s+term|首项|第一项)\s*(?:=|is|为|是)?\s*([+-]?\d+(?:\.\d+)?)/i);
  const differenceMatch = prompt.match(/\b(?:d|common\s+difference|公差)\s*(?:=|is|为|是)?\s*([+-]?\d+(?:\.\d+)?)/i);
  const targetMatches = Array.from(prompt.matchAll(/\b(?:a_?\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+term|第\s*(\d+)\s*项)\b/gi));
  const targetMatch = targetMatches[targetMatches.length - 1];
  if (!firstTermMatch || !differenceMatch || !targetMatch) return null;
  const first = Number(firstTermMatch[1]);
  const difference = Number(differenceMatch[1]);
  const targetIndex = Number(targetMatch[1] ?? targetMatch[2] ?? targetMatch[3]);
  if (![first, difference, targetIndex].every(Number.isFinite) || targetIndex < 1) return null;
  return first + (targetIndex - 1) * difference;
}

function inferLinearEquationSolution(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-').replace(/[，,]/g, '');
  if (!/\b(?:solve|solution|value of x)\b|求解|解方程|x\s*的值/i.test(prompt)) return null;
  const match = prompt.match(/([+-]?\d+(?:\.\d+)?)?\s*\*?\s*x\s*([+-]\s*\d+(?:\.\d+)?)?\s*=\s*([+-]?\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const coefficientText = match[1];
  const coefficient = coefficientText === undefined || coefficientText === '' || coefficientText === '+'
    ? 1
    : coefficientText === '-'
      ? -1
      : Number(coefficientText);
  const constant = Number(String(match[2] ?? 0).replace(/\s+/g, ''));
  const right = Number(match[3]);
  if (![coefficient, constant, right].every(Number.isFinite) || coefficient === 0) return null;
  return (right - constant) / coefficient;
}

function likelyPhysicsExpectedUnits(candidate: GeneratedQuestionCandidate) {
  const body = text([candidate.prompt, candidate.explanation, ...candidate.knowledgeTags].join(' ')).toLowerCase();
  if (/\b(speed|velocity|rate of motion)\b|速度|速率/.test(body)) return ['m/s', 'm·s^-1', 'm s^-1', '米/秒'];
  if (/\b(acceleration)\b|加速度/.test(body)) return ['m/s^2', 'm·s^-2', 'm s^-2', 'cm/s^2', 'cm·s^-2', 'cm s^-2', '米/秒^2', '厘米/秒^2'];
  if (/\b(density)\b|密度/.test(body)) return ['kg/m^3', 'kg·m^-3', 'kg m^-3', '千克/立方米', 'g/cm^3', 'g·cm^-3', 'g cm^-3', '克/立方厘米'];
  if (/\b(force)\b|力\b/.test(body)) return ['n', 'newton', '牛'];
  if (/\benergy|work\b|能量|功\b/.test(body)) return ['j', 'joule', '焦'];
  if (/\bpower\b|功率/.test(body)) return ['w', 'watt', '瓦'];
  return [];
}

function optionHasUnit(value: string, units: string[]) {
  const normalized = text(value).toLowerCase().replace(/\s+/g, ' ');
  return units.some((unit) => normalized.includes(unit.toLowerCase()));
}

function unitMultiplier(unit: string) {
  const normalized = unit.toLowerCase();
  if (normalized === 'km' || normalized.includes('kilometer') || normalized.includes('kilometre')) return 1000;
  if (normalized === 'cm' || normalized.includes('centimeter') || normalized.includes('centimetre')) return 0.01;
  if (normalized === 'g' || normalized.includes('gram') || normalized.includes('克')) return 0.001;
  if (normalized === 'min' || normalized.includes('minute') || normalized.includes('分钟')) return 60;
  if (normalized === 'h' || normalized === 'hr' || normalized === 'hrs' || normalized.includes('hour') || normalized.includes('小时')) return 3600;
  return 1;
}

function volumeMultiplier(unit: string) {
  const normalized = unit.toLowerCase();
  if (normalized === 'cm3' || normalized === 'cm^3' || normalized === 'cm³' || normalized.includes('cubic centimeter') || normalized.includes('cubic centimetre') || normalized.includes('立方厘米')) return 0.000001;
  if (normalized === 'm3' || normalized === 'm^3' || normalized === 'm³' || normalized.includes('cubic meter') || normalized.includes('cubic metre') || normalized.includes('立方米')) return 1;
  return 1;
}

function densityValueMultiplier(value: string) {
  const normalized = text(value).toLowerCase();
  if (/g\s*(?:\/|per)\s*cm(?:\^?3|³)|g\s*cm\^-?3|克\s*\/\s*立方厘米/.test(normalized)) return 1000;
  if (/kg\s*(?:\/|per)\s*m(?:\^?3|³)|kg\s*m\^-?3|千克\s*\/\s*立方米/.test(normalized)) return 1;
  return 1;
}

function accelerationValueMultiplier(value: string) {
  const normalized = text(value).toLowerCase();
  if (/cm\s*(?:\/|per)\s*s(?:\^?2|²)|cm\s*s\^-?2|厘米\s*\/\s*秒\^?2/.test(normalized)) return 0.01;
  if (/(^|[^a-z])m\s*(?:\/|per)\s*s(?:\^?2|²)|(^|[^a-z])m\s*s\^-?2|米\s*\/\s*秒\^?2/.test(normalized)) return 1;
  return 1;
}

function speedMultiplier(unit: string) {
  const normalized = unit.toLowerCase().replace(/\s+/g, '');
  if (/km\/h|kmperh|kmh|千米\/小时|公里\/小时/.test(normalized)) return 1000 / 3600;
  if (/cm\/s|cmpersecond|厘米\/秒/.test(normalized)) return 0.01;
  return 1;
}

function inferPhysicsSpeedAnswer(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-');
  const match = prompt.match(/(?:travels?|moves?|covers?|distance(?:\s+of)?|行驶|移动|距离)[^0-9-]*([+-]?\d+(?:\.\d+)?)\s*(km|m|cm|kilometers?|kilometres?|meters?|metres?|centimeters?|centimetres?)[^0-9-]*(?:in|over|during|用时|时间|在)\s*([+-]?\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|minutes?|s|sec|secs|seconds?|秒|分钟|小时)/i)
    ?? prompt.match(/([+-]?\d+(?:\.\d+)?)\s*(km|m|cm|kilometers?|kilometres?|meters?|metres?|centimeters?|centimetres?)\s*(?:in|over|during|用时|时间|在)\s*([+-]?\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|minutes?|s|sec|secs|seconds?|秒|分钟|小时)/i);
  if (!match) return null;
  const distance = Number(match[1]) * unitMultiplier(match[2]);
  const duration = Number(match[3]) * unitMultiplier(match[4]);
  if (!Number.isFinite(distance) || !Number.isFinite(duration) || duration === 0) return null;
  return distance / duration;
}

function inferPhysicsAccelerationAnswer(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-');
  if (!/\b(acceleration)\b|加速度/.test(prompt.toLowerCase())) return null;
  const velocityUnit = 'm\\s*(?:\\/|per)\\s*s|m\\s*s\\^-?1|m\\/s|米\\s*\\/\\s*秒|cm\\s*(?:\\/|per)\\s*s|cm\\/s|厘米\\s*\\/\\s*秒|km\\s*(?:\\/|per)\\s*h|km\\/h|千米\\s*\\/\\s*小时|公里\\s*\\/\\s*小时';
  const timeUnit = 'h|hr|hrs|hours?|min|minutes?|s|sec|secs|seconds?|秒|分钟|小时';
  const initialMatch = prompt.match(new RegExp(`(?:initial\\s+(?:velocity|speed)|starts?\\s+at|from|初速度|初始速度)[^0-9-]*([+-]?\\d+(?:\\.\\d+)?)\\s*(${velocityUnit})`, 'i'));
  const finalMatch = prompt.match(new RegExp(`(?:final\\s+(?:velocity|speed)|reaches?|to|末速度|最终速度)[^0-9-]*([+-]?\\d+(?:\\.\\d+)?)\\s*(${velocityUnit})`, 'i'));
  const timeMatch = prompt.match(new RegExp(`(?:in|over|during|time|用时|时间|在)[^0-9-]*([+-]?\\d+(?:\\.\\d+)?)\\s*(${timeUnit})`, 'i'));
  if (!initialMatch || !finalMatch || !timeMatch) return null;
  const initial = Number(initialMatch[1]) * speedMultiplier(initialMatch[2]);
  const final = Number(finalMatch[1]) * speedMultiplier(finalMatch[2]);
  const duration = Number(timeMatch[1]) * unitMultiplier(timeMatch[2]);
  if (![initial, final, duration].every(Number.isFinite) || duration === 0) return null;
  return (final - initial) / duration;
}

function inferPhysicsDensityAnswer(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt).replace(/[−－]/g, '-');
  if (!/\b(density)\b|密度/.test(prompt.toLowerCase())) return null;
  const massMatch = prompt.match(/(?:mass|质量)[^0-9-]*([+-]?\d+(?:\.\d+)?)\s*(kg|g|kilograms?|grams?|千克|克)/i);
  const volumeMatch = prompt.match(/(?:volume|体积)[^0-9-]*([+-]?\d+(?:\.\d+)?)\s*(m3|m\^3|m³|cm3|cm\^3|cm³|cubic meters?|cubic metres?|cubic centimeters?|cubic centimetres?|立方米|立方厘米)/i);
  if (!massMatch || !volumeMatch) return null;
  const mass = Number(massMatch[1]) * unitMultiplier(massMatch[2]);
  const volume = Number(volumeMatch[1]) * volumeMultiplier(volumeMatch[2]);
  if (!Number.isFinite(mass) || !Number.isFinite(volume) || volume === 0) return null;
  return mass / volume;
}

function hasHorizontalElectricField(prompt: string) {
  return /(电场|electric\s+field)[^。；;,.，]*(水平|向右|向左|horizontal|right|left)/i.test(prompt)
    || /(水平|向右|向左|horizontal|right|left)[^。；;,.，]*(电场|electric\s+field)/i.test(prompt);
}

function hasHorizontalInitialVelocity(prompt: string) {
  return /(初速度|初始速度|速度|initial\s+(?:velocity|speed)|velocity)[^。；;,.，]*(水平|horizontal)/i.test(prompt)
    || /(水平|horizontal)[^。；;,.，]*(射入|进入|抛出|运动|速度|velocity)/i.test(prompt);
}

function asksVerticalOffset(prompt: string) {
  return /(竖直|垂直|vertical)[^。；;,.，]*(偏移|位移|距离|offset|displacement|deflection)/i.test(prompt)
    || /(偏移|位移|offset|displacement|deflection)[^。；;,.，]*(竖直|垂直|vertical)/i.test(prompt);
}

function hasVerticalForceSource(prompt: string) {
  const withoutNegatedGravity = prompt.replace(/不计重力|忽略重力|neglect(?:ing)?\s+gravity|ignore(?:s|ing)?\s+gravity/gi, '');
  return /重力|gravity|竖直[^。；;,.，]*(电场|electric\s+field)|vertical[^。；;,.，]*(electric\s+field)/i.test(withoutNegatedGravity);
}

function physicsElectricFieldDeflectionAxisConflict(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  return hasHorizontalInitialVelocity(prompt)
    && hasHorizontalElectricField(prompt)
    && asksVerticalOffset(prompt)
    && !hasVerticalForceSource(prompt);
}

type AxisDirection = 'up' | 'down' | 'left' | 'right';

function directionFromText(value: string, keywordPattern: string): AxisDirection | null {
  const normalized = text(value).toLowerCase();
  const patterns: Array<[AxisDirection, RegExp]> = [
    ['up', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向上|竖直向上|upward|up)`, 'i')],
    ['down', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向下|竖直向下|downward|down)`, 'i')],
    ['left', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向左|水平向左|leftward|left)`, 'i')],
    ['right', new RegExp(`${keywordPattern}[^。；;.]{0,80}(向右|水平向右|rightward|right)`, 'i')],
    ['up', new RegExp(`(向上|竖直向上|upward|up)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['down', new RegExp(`(向下|竖直向下|downward|down)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['left', new RegExp(`(向左|水平向左|leftward|left)[^。；;.]{0,80}${keywordPattern}`, 'i')],
    ['right', new RegExp(`(向右|水平向右|rightward|right)[^。；;.]{0,80}${keywordPattern}`, 'i')]
  ];
  for (const [direction, pattern] of patterns) {
    if (pattern.test(normalized)) return direction;
  }
  return null;
}

function movementDirectionFromPrompt(prompt: string): AxisDirection | null {
  if (/沿(?:着)?电场方向|顺(?:着)?电场方向|along\s+the\s+electric\s+field/i.test(prompt)) return directionFromText(prompt, '(?:电场|electric\\s+field)');
  return directionFromText(prompt, '(?:移动|运动|位移|移到|到达|moves?|travels?|displacement)');
}

function physicsPotentialEnergySignConflict(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  const explanation = text(candidate.explanation);
  const body = `${prompt} ${explanation}`;
  const positiveCharge = /正电荷|带正电|电荷量为\s*\+?\s*q|电荷量\s*[=＝]\s*\+|positive\s+charge|\bq\s*>\s*0|\+\s*q\b/i.test(body);
  if (!positiveCharge || /负电荷|带负电|negative\s+charge|\bq\s*<\s*0/i.test(body)) return false;
  const fieldDirection = directionFromText(prompt, '(?:电场|electric\\s+field)');
  const movementDirection = movementDirectionFromPrompt(prompt);
  const alongField = /沿(?:着)?电场方向|顺(?:着)?电场方向|along\s+the\s+electric\s+field/i.test(prompt)
    || Boolean(fieldDirection && movementDirection && fieldDirection === movementDirection)
    || (/垂直[^。；;,.，]*(?:进入|射入)[^。；;,.，]*(?:电场)|(?:enter|enters|entered)[^。；;,.，]*(?:perpendicular|normal)[^。；;,.，]*(?:electric\s+field)/i.test(prompt) && Boolean(fieldDirection));
  if (!alongField) return false;
  const claimsIncrease = /电势能(?:的)?(?:增加量|增大|增加)|potential\s+energy\s+(?:increases?|increase)|Δ\s*(?:u|e[pP])\s*>\s*0/i.test(body);
  const usesPositiveFieldWorkAsEnergy = /(?:Δ|delta)\s*(?:u|e[pP])\s*=\s*q\s*e|电势能[^。；;,.，]*(?:qE|q\s*E)|(?:qE|q\s*E)[^。；;,.，]*电势能/i.test(explanation);
  return claimsIncrease || usesPositiveFieldWorkAsEnergy;
}

const CHEMISTRY_SUBSCRIPT_DIGITS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9'
};

function normalizeChemistryEquationText(value: string) {
  return text(value)
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (digit) => CHEMISTRY_SUBSCRIPT_DIGITS[digit] ?? digit)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]/g, '')
    .replace(/[↑↓]/g, '')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=');
}

function stripInlineIonicChargesForEquationScan(value: string) {
  const boundary = String.raw`(?=\s*(?:\+|->|=|→|$|[。；;,.，)]))`;
  return value
    .replace(new RegExp(String.raw`\^?(?:\d+)?[+-]${boundary}`, 'g'), '')
    .replace(new RegExp(String.raw`\b([A-Z][a-z]?)(\d+)[+-]${boundary}`, 'g'), '$1');
}

function stripTrailingIonicCharge(formula: string) {
  const normalized = formula.replace(/\s+/g, '');
  if (/^[A-Z][a-z]?\d+[+-]$/.test(normalized)) {
    return normalized.replace(/\d+[+-]$/, '');
  }
  return normalized
    .replace(/\^(?:\d+)?[+-]$/, '')
    .replace(/[+-]$/, '');
}

function parseFormulaCounts(formula: string) {
  const counts = new Map<string, number>();
  const normalized = stripTrailingIonicCharge(formula);

  function readNumber() {
    const start = index;
    while (index < normalized.length && /\d/.test(normalized[index])) index += 1;
    return start === index ? 1 : Number(normalized.slice(start, index));
  }

  function merge(target: Map<string, number>, source: Map<string, number>, multiplier: number) {
    for (const [element, count] of source.entries()) {
      target.set(element, (target.get(element) ?? 0) + count * multiplier);
    }
  }

  if (/[·•]/.test(normalized)) {
    const hydrateCounts = new Map<string, number>();
    const segments = normalized.split(/[·•]/).map((part) => part.trim()).filter(Boolean);
    if (segments.length < 2) return null;
    for (const segment of segments) {
      const match = segment.match(/^(\d+)([A-Z].*)$/);
      const multiplier = match ? Number(match[1]) : 1;
      const formulaPart = match ? match[2] : segment;
      const segmentCounts = parseFormulaCounts(formulaPart);
      if (!segmentCounts) return null;
      merge(hydrateCounts, segmentCounts, multiplier);
    }
    return hydrateCounts;
  }

  let index = 0;

  function parseGroup(): Map<string, number> | null {
    const group = new Map<string, number>();
    let matched = false;
    while (index < normalized.length) {
      const char = normalized[index];
      if (char === ')') break;
      if (char === '(') {
        index += 1;
        const nested = parseGroup();
        if (!nested || normalized[index] !== ')') return null;
        index += 1;
        merge(group, nested, readNumber());
        matched = true;
        continue;
      }
      const elementMatch = normalized.slice(index).match(/^([A-Z][a-z]?)/);
      if (!elementMatch) return null;
      index += elementMatch[1].length;
      const count = readNumber();
      group.set(elementMatch[1], (group.get(elementMatch[1]) ?? 0) + count);
      matched = true;
    }
    return matched ? group : null;
  }

  const parsed = parseGroup();
  if (!parsed || index !== normalized.length) return null;
  merge(counts, parsed, 1);
  return counts;
}

function mergeFormulaCounts(target: Map<string, number>, formula: string, multiplier: number) {
  const counts = parseFormulaCounts(formula);
  if (!counts) return false;
  for (const [element, count] of counts.entries()) {
    target.set(element, (target.get(element) ?? 0) + count * multiplier);
  }
  return true;
}

function sideElementCounts(side: string) {
  const counts = new Map<string, number>();
  const compounds = side.split('+').map((part) => part.trim()).filter(Boolean);
  if (!compounds.length) return null;
  for (const compound of compounds) {
    const match = compound.match(/^(\d*)\s*([A-Z][A-Za-z0-9()·•]*?)$/);
    if (!match) return null;
    const multiplier = Number(match[1] || 1);
    if (!mergeFormulaCounts(counts, match[2], multiplier)) return null;
  }
  return counts;
}

function sameElementCounts(first: Map<string, number>, second: Map<string, number>) {
  const keys = new Set([...first.keys(), ...second.keys()]);
  for (const key of keys) {
    if ((first.get(key) ?? 0) !== (second.get(key) ?? 0)) return false;
  }
  return true;
}

function isLikelyPropertyTrendArrow(source: string, equation: string, index: number) {
  if (!/(?:->|→)/.test(equation)) return false;
  const [left, right] = equation.split(/->|→/).map((part) => part.trim());
  if (!left || !right || left.includes('+') || right.includes('+')) return false;
  const context = source.slice(Math.max(0, index - 80), index + equation.length + 80);
  return /(趋势|递变|预测|外推|比较|数据|沸点|熔点|汽化热|焓变|键能|摩尔质量|分子量|相对分子质量|trend|predict|estimate|extrapolat|compare|boiling point|melting point|enthalpy|bond energy|molar mass)/i.test(context);
}

function isLikelyEquilibriumVariableRelation(source: string, equation: string, index: number) {
  const compact = equation.replace(/\s+/g, '');
  const relationToken = '(?:Q|Qc|Qp|K|Kc|Kp)[0-9０-９₀-₉]*';
  const context = source.slice(Math.max(0, index - 100), index + equation.length + 100);
  const isVariableRelation = new RegExp(`^${relationToken}=${relationToken}$`, 'i').test(compact);
  const isUnitBoundaryArtifact = new RegExp(`^L=${relationToken}$`, 'i').test(compact)
    && /mol\s*[·./]?\s*L/i.test(context);
  if (!isVariableRelation && !isUnitBoundaryArtifact) return false;
  return /(反应商|平衡常数|平衡|equilibrium|reaction quotient|equilibrium constant|le chatelier)/i.test(context);
}

function unbalancedChemicalEquations(value: string) {
  const source = stripInlineIonicChargesForEquationScan(normalizeChemistryEquationText(value));
  const equationPattern = /\d*[A-Z][A-Za-z0-9()·•]*(?:\s*\+\s*\d*[A-Z][A-Za-z0-9()·•]*)*\s*(?:->|=|→)\s*\d*[A-Z][A-Za-z0-9()·•]*(?:\s*\+\s*\d*[A-Z][A-Za-z0-9()·•]*)*/g;
  const candidates = Array.from(source.matchAll(equationPattern));
  return candidates.map((match) => ({ equation: match[0], index: match.index ?? 0 })).filter(({ equation, index }) => {
    if (isLikelyPropertyTrendArrow(source, equation, index)) return false;
    if (isLikelyEquilibriumVariableRelation(source, equation, index)) return false;
    const [left, right] = equation.split(/->|=|→/);
    const leftCounts = sideElementCounts(left ?? '');
    const rightCounts = sideElementCounts(right ?? '');
    return Boolean(leftCounts && rightCounts && !sameElementCounts(leftCounts, rightCounts));
  }).map(({ equation }) => equation);
}

function underdeterminedEquilibriumTemperatureInference(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  const body = `${prompt} ${candidate.options.map((option) => text(option.text)).join(' ')} ${text(candidate.explanation)}`;
  const asksHeatEffect = /放热|吸热|exothermic|endothermic/i.test(body);
  const asksTemperatureDirection = /升高|降低|升温|降温|temperature (?:increases?|decreases?|raised|lowered)|higher temperature|lower temperature/i.test(body);
  const equilibriumSignal = /平衡常数|equilibrium constant|\bK\b|K['′’]?|K\s*(?:=|为)|K值/i.test(body)
    && /平衡|equilibrium|⇌|<=>|↔/.test(body);
  const hasObservedConstantChange = /K['′’]?\s*(?:增大|减小|变大|变小|降低|升高)|平衡常数.{0,24}(增大|减小|变大|变小|降低|升高)|K\s*(?:from|由).{0,40}(?:to|变为|到)|K\s*[=＝]\s*\d/i.test(body);
  const promptStatesTemperatureDirection = /温度(?:升高|降低)|(?:升高|降低)温度后|升温后|降温后|temperature (?:was )?(?:raised|lowered|increased|decreased)/i.test(prompt);
  return equilibriumSignal && asksHeatEffect && asksTemperatureDirection && hasObservedConstantChange && !promptStatesTemperatureDirection;
}

function gasStoichiometricCount(side: string) {
  let count = 0;
  let matched = false;
  const parts = side.split('+').map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const species = part.match(/^(\d*)\s*[A-Za-z][A-Za-z0-9]*(?:\((?!\s*[gsl]\s*\))[A-Za-z0-9]+\)\d*)*\s*(?:\(\s*([gsl])\s*\)|([gsl])\b)?/i);
    if (!species) continue;
    matched = true;
    const phase = String(species[2] || species[3] || '').toLowerCase();
    if (phase === 'g') count += Number(species[1] || 1);
  }
  return matched ? count : null;
}

function equilibriumGasMoleChange(prompt: string) {
  const source = normalizeChemistryEquationText(prompt);
  const species = String.raw`\d*\s*[A-Za-z][A-Za-z0-9]*(?:\((?!\s*[gsl]\s*\))[A-Za-z0-9]+\)\d*)*\s*(?:\(\s*[gsl]\s*\)|[gsl]\b)?`;
  const equation = source.match(new RegExp(`${species}(?:\\s*\\+\\s*${species})*\\s*(?:⇌|↔|<=>)\\s*${species}(?:\\s*\\+\\s*${species})*`, 'i'))?.[0];
  if (!equation) return null;
  const [left, right] = equation.split(/⇌|↔|<=>/);
  const leftCount = gasStoichiometricCount(left ?? '');
  const rightCount = gasStoichiometricCount(right ?? '');
  if (leftCount === null || rightCount === null || leftCount === rightCount) return null;
  return { leftCount, rightCount, forwardDecreasesGasMoles: rightCount < leftCount };
}

function chemistryEquilibriumPressureDirectionConflict(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  const body = `${prompt} ${correctOptionText(candidate)} ${text(candidate.explanation)}`;
  const moleChange = equilibriumGasMoleChange(prompt);
  if (!moleChange) return false;
  const compressionPattern = /压缩|体积(?:减小|缩小|变小|减半)|增大压强|压强增大|compress|compression|volume (?:decreases?|halved|reduced)|pressure (?:increases?|raised)/i;
  if (!compressionPattern.test(body)) return false;
  const clauses = body.split(/(?<=[。；;.!?？])/).map((clause) => clause.trim()).filter(Boolean);
  const pressureClauses: string[] = [];
  clauses.forEach((clause, index) => {
    if (!compressionPattern.test(clause)) return;
    pressureClauses.push(clause);
    if (clauses[index + 1] && /^(?:实际|因此|故|所以|说明|这|该|现|but|therefore|so|hence)/i.test(clauses[index + 1])) {
      pressureClauses.push(clauses[index + 1]);
    }
  });
  const pressureContext = pressureClauses.join(' ') || body;
  const claimsReverse = /逆(?:反应)?方向|逆向|向左|reverse direction|shift(?:s|ed)? (?:left|reverse)/i.test(pressureContext);
  const claimsForward = /正(?:反应)?方向|正向|向右|forward direction|shift(?:s|ed)? (?:right|forward)/i.test(pressureContext);
  const claimsForwardGasIncrease = /正反应[^。；;,.，]*(?:气体(?:分子数|物质的量|体积)(?:增大|增加|变大|更多)|more gas)|forward reaction[^.。；;]*(?:more gas|increases? gas)/i.test(pressureContext);
  if (claimsForwardGasIncrease && moleChange.forwardDecreasesGasMoles) return true;
  if (moleChange.forwardDecreasesGasMoles && claimsReverse) return true;
  if (!moleChange.forwardDecreasesGasMoles && claimsForward) return true;
  return false;
}

function normalizeChemicalFactText(value: string) {
  return text(value)
    .replace(/[₀０]/g, '0')
    .replace(/[₁１]/g, '1')
    .replace(/[₂２]/g, '2')
    .replace(/[₃３]/g, '3')
    .replace(/[₄４]/g, '4')
    .replace(/[₅５]/g, '5')
    .replace(/[₆６]/g, '6')
    .replace(/[₇７]/g, '7')
    .replace(/[₈８]/g, '8')
    .replace(/[₉９]/g, '9');
}

function endorsedIronCombustionProductConflict(candidate: GeneratedQuestionCandidate) {
  const prompt = normalizeChemicalFactText(candidate.prompt);
  const answer = normalizeChemicalFactText(correctOptionText(candidate));
  const explanation = normalizeChemicalFactText(candidate.explanation);
  const body = `${prompt} ${answer} ${explanation}`;
  const ironCombustion = /(?:铁丝?|Fe).{0,16}(?:氧气|O2).{0,16}(?:燃烧|剧烈燃烧|反应)|(?:燃烧|剧烈燃烧).{0,16}(?:铁丝?|Fe).{0,16}(?:氧气|O2)/i.test(body);
  if (!ironCombustion) return false;

  const clauses = body.split(/(?<=[。；;.!?？])|(?=选项[A-D]|[A-D][.、])/).map((clause) => clause.trim()).filter(Boolean);
  return clauses.some((clause) => {
    const endorsesFerricOxide = /(?:生成|产物(?:是|为)?|得到|形成).{0,16}(?:Fe2O3|氧化铁|红棕色(?:固体|氧化铁)?)/i.test(clause)
      || /(?:Fe2O3|氧化铁|红棕色(?:固体|氧化铁)?).{0,12}(?:生成|产物|配平后的化学方程式|正确)/i.test(clause);
    const negated = /(?:不是|并非|不能|不应|错误|不正确|不符合|而不是|not|incorrect|wrong)/i.test(clause);
    return endorsesFerricOxide && !negated && !/Fe3O4|四氧化三铁|黑色固体/.test(clause);
  });
}

function hasCompoundSingleChoiceOption(candidate: GeneratedQuestionCandidate) {
  return candidate.options.some((option) => {
    const value = text(option.text).toLowerCase();
    return /\b(all|both|none)\s+of\s+the\s+above\b/.test(value)
      || /\b(?:a\s+and\s+b|b\s+and\s+c|c\s+and\s+d|a\s+or\s+b|b\s+or\s+c|c\s+or\s+d)\b/.test(value)
      || /以上(?:皆|都|均|全)(?:是|正确|不正确)/.test(value)
      || /(?:都|均|全)(?:正确|不正确)/.test(value);
  });
}

function hasContaminatedChlorideInference(candidate: GeneratedQuestionCandidate) {
  const prompt = text(candidate.prompt);
  const correct = text(correctOptionText(candidate));
  const explanation = text(candidate.explanation);
  const body = `${prompt} ${candidate.options.map((option) => text(option.text)).join(' ')} ${explanation}`;
  const usesAddedChlorideBeforeSilverTest = /(盐酸|hcl|氯化钡|bacl2|bacl₂|ba\s*cl)/i.test(prompt)
    && /(agno3|agNO₃|硝酸银)/i.test(prompt)
    && /(白色沉淀|agcl|氯化银|silver chloride)/i.test(body);
  const assertsOriginalChloride = /(一定|说明|证明|推出|存在|含有|原溶液).{0,24}(cl-|cl⁻|氯离子|chloride)|(cl-|cl⁻|氯离子|chloride).{0,24}(一定|说明|证明|推出|存在|含有|原溶液)/i.test(`${correct} ${explanation}`);
  const ionInferenceTopic = /(离子|沉淀|溶液可能含|possible.*ions?|ion inference|qualitative ion)/i.test(body);
  return ionInferenceTopic && usesAddedChlorideBeforeSilverTest && assertsOriginalChloride;
}

@Injectable()
export class QuestionValidatorService {
  review(candidate: GeneratedQuestionCandidate, context: ReviewContext = {}): ReviewResult {
    const issues: ValidationIssue[] = [];
    const dimensions: ReviewDimension[] = [];
    const optionIds = candidate.options.map((option) => option.id);
    const correctMatches = optionIds.filter((id) => id === candidate.correctAnswer).length;
    const allowedQuestionTypes = asArray(context.allowedQuestionTypes);
    const allowedDifficulties = asArray(context.difficultyRange);
    const excludedScope = asArray(context.excludedScope);
    const duplicatePromptCount = Number(context.duplicatePromptCount ?? 0);
    const nearDuplicateCount = nearDuplicatePromptCount(candidate.prompt, context.duplicatePrompts ?? []);

    if (!text(candidate.prompt)) {
      issues.push({ code: 'missing_prompt', severity: 'error', message: 'Question prompt is required.' });
    }
    if (hasUnbackedVisualReference(candidate)) {
      issues.push({
        code: 'unbacked_visual_reference',
        severity: 'warning',
        message: 'Prompt references a figure/diagram that is not attached to the generated question; rewrite the visual context into text or remove the visual reference before auto-publication.'
      });
    }
    if (candidate.options.length < 4) {
      issues.push({ code: 'not_enough_options', severity: 'error', message: 'A CSCA multiple-choice question should have at least four options.' });
    }
    if (new Set(optionIds).size !== optionIds.length) {
      issues.push({ code: 'duplicate_option_ids', severity: 'error', message: 'Option ids must be unique.' });
    }
    if (candidate.options.some((option) => !text(option.text))) {
      issues.push({ code: 'empty_option', severity: 'error', message: 'Every option must have visible text.' });
    }
    if (hasDuplicateOptionText(candidate.options)) {
      issues.push({ code: 'duplicate_option_text', severity: 'error', message: 'Option texts must be mutually distinguishable.' });
    }
    if (hasEquivalentOptionText(candidate.options)) {
      issues.push({ code: 'equivalent_option_text', severity: 'error', message: 'Option texts appear equivalent after normalization.' });
    }
    const genericDistractorIds = candidate.options
      .filter((option) => option.id !== candidate.correctAnswer && isGenericDistractorText(option.text))
      .map((option) => option.id);
    if (genericDistractorIds.length) {
      issues.push({ code: 'generic_distractor_text', severity: 'warning', message: `Distractors ${genericDistractorIds.join(', ')} are too generic to teach a misconception.` });
    }
    if (correctMatches !== 1) {
      issues.push({ code: 'invalid_correct_answer', severity: 'error', message: 'Exactly one option must match the correct answer.' });
    }
    if (context.subject && candidate.subject !== context.subject) {
      issues.push({ code: 'subject_mismatch', severity: 'error', message: 'Question subject must match the selected syllabus topic.' });
    }
    if (context.topicId && candidate.topicId !== context.topicId) {
      issues.push({ code: 'topic_mismatch', severity: 'error', message: 'Question topic must match the selected syllabus topic.' });
    }
    if (context.syllabusVersion && candidate.syllabusVersion !== context.syllabusVersion) {
      issues.push({ code: 'syllabus_version_mismatch', severity: 'error', message: 'Question syllabus version must match the topic syllabus version.' });
    }
    if (context.topicStatus && context.topicStatus !== 'published') {
      issues.push({ code: 'topic_not_published', severity: 'warning', message: 'Question is attached to a syllabus topic that is not published.' });
    }
    if (allowedQuestionTypes.length && !allowedQuestionTypes.includes(candidate.questionType)) {
      issues.push({ code: 'question_type_out_of_scope', severity: 'error', message: 'Question type is not allowed by this syllabus topic.' });
    }
    const allowedDifficultyKeys = allowedDifficulties.map(difficultyKey);
    const candidateDifficultyKey = difficultyKey(candidate.designedDifficulty);
    if (allowedDifficultyKeys.length && !allowedDifficultyKeys.includes(candidateDifficultyKey)) {
      issues.push({ code: 'difficulty_out_of_scope', severity: 'warning', message: 'Designed difficulty is outside the topic difficulty range.' });
    }
    if (context.examScope !== undefined && !text(context.examScope)) {
      issues.push({ code: 'missing_exam_scope', severity: 'warning', message: 'Syllabus topic is missing exam scope, so alignment cannot be verified strongly.' });
    }
    const candidateBodyForScope = [candidate.prompt, candidate.explanation, ...candidate.options.map((option) => option.text)].join(' ');
    const excludedScopeHits = excludedScope.filter((scope) => containsNeedle(candidateBodyForScope, scope));
    if (excludedScopeHits.length) {
      issues.push({ code: 'excluded_scope_overlap', severity: 'error', message: `Question overlaps excluded syllabus scope: ${excludedScopeHits.slice(0, 3).join(', ')}.` });
    }
    const candidateBodyForSyllabusSignal = [
      candidateBodyForScope,
      ...candidate.knowledgeTags,
      ...Object.values(candidate.localizations ?? {}).flatMap((localized) => localized.knowledgeTags ?? [])
    ].join(' ');
    const syllabusSignals = [context.topicTitle, context.examScope].filter(Boolean).map((item) => text(item));
    const hasSyllabusSignal = syllabusSignals.length === 0
      || syllabusSignals.some((signal) => containsSyllabusSignal(candidateBodyForSyllabusSignal, signal));
    if (!hasSyllabusSignal) {
      issues.push({ code: 'weak_syllabus_signal', severity: 'warning', message: 'Question does not visibly reference the topic title, exam scope, or knowledge tags.' });
    }
    dimensions.push({
      key: 'syllabus_alignment',
      status: excludedScopeHits.length
        ? 'failed'
        : hasSyllabusSignal && candidate.subject === (context.subject ?? candidate.subject) && candidate.topicId === (context.topicId ?? candidate.topicId) ? 'passed' : 'warning',
      note: excludedScopeHits.length
        ? `Candidate references excluded scope: ${excludedScopeHits.slice(0, 3).join(', ')}.`
        : hasSyllabusSignal ? 'Deterministic check found topic/syllabus signals in the candidate.' : 'Topic alignment needs reviewer confirmation.'
    });
    dimensions.push({
      key: 'single_correct_answer',
      status: correctMatches === 1 ? 'passed' : 'failed',
      note: correctMatches === 1 ? 'Exactly one option id matches the declared correct answer.' : 'The declared correct answer does not match exactly one option.'
    });
    dimensions.push({
      key: 'option_mutual_exclusion',
      status: new Set(optionIds).size === optionIds.length && !hasDuplicateOptionText(candidate.options) && !hasEquivalentOptionText(candidate.options) ? 'passed' : 'failed',
      note: 'Deterministic check verifies option ids and visible option text are distinct after normalization.'
    });
    if (text(candidate.explanation).length < 20) {
      issues.push({ code: 'weak_explanation', severity: 'warning', message: 'Explanation should be long enough to support the answer.' });
    }
    const explanationMentionsAnswer = containsNeedle(candidate.explanation, candidate.correctAnswer)
      || containsNeedle(candidate.explanation, correctOptionText(candidate));
    const explanationDeclaredAnswer = declaredAnswerInExplanation(candidate.explanation);
    if (explanationDeclaredAnswer && explanationDeclaredAnswer !== candidate.correctAnswer) {
      issues.push({ code: 'explanation_answer_conflict', severity: 'error', message: 'Explanation declares a different correct answer than the structured answer.' });
    }
    if (hasSelfCorrectingOrUncertainExplanation(candidate)) {
      issues.push({
        code: 'self_correcting_or_uncertain_explanation',
        severity: 'error',
        message: 'Explanation contains self-correction or uncertainty markers and is not publishable without a clean automatic quality gate.'
      });
    }
    if (text(candidate.explanation).length >= 20 && !explanationMentionsAnswer) {
      issues.push({ code: 'explanation_missing_answer_reference', severity: 'warning', message: 'Explanation should explicitly reference the correct option or its content.' });
    }
    dimensions.push({
      key: 'explanation_supports_answer',
      status: explanationDeclaredAnswer && explanationDeclaredAnswer !== candidate.correctAnswer
        ? 'failed'
        : text(candidate.explanation).length >= 20 && explanationMentionsAnswer ? 'passed' : 'warning',
      note: explanationDeclaredAnswer && explanationDeclaredAnswer !== candidate.correctAnswer
        ? `Explanation declares ${explanationDeclaredAnswer}, but structured answer is ${candidate.correctAnswer}.`
        : explanationMentionsAnswer ? 'Explanation references the declared correct answer.' : 'Explanation needs reviewer confirmation because it does not clearly cite the answer.'
    });
    if (!candidate.knowledgeTags.length) {
      issues.push({ code: 'missing_knowledge_tags', severity: 'warning', message: 'At least one knowledge tag is recommended.' });
    }
    if (candidate.optionMetadata.length && candidate.optionMetadata.some((item) => !optionIds.includes(item.optionId))) {
      issues.push({ code: 'orphan_option_metadata', severity: 'warning', message: 'Option metadata must point to existing options.' });
    }
    const incorrectOptionIds = optionIds.filter((id) => id !== candidate.correctAnswer);
    const metadataByOption = new Map(candidate.optionMetadata.map((item) => [item.optionId, item]));
    const missingDistractorMetadata = incorrectOptionIds.filter((id) => {
      const metadata = metadataByOption.get(id);
      return !metadata?.distractorIntent || !metadata.misconceptionTags?.length;
    });
    if (missingDistractorMetadata.length) {
      issues.push({ code: 'incomplete_distractor_metadata', severity: 'warning', message: 'Each incorrect option should have distractor intent and misconception tags.' });
    }
    const correctOptionMetadata = metadataByOption.get(candidate.correctAnswer);
    if (correctOptionMetadata?.distractorIntent || correctOptionMetadata?.misconceptionTags?.length) {
      issues.push({ code: 'correct_option_has_distractor_metadata', severity: 'warning', message: 'Correct option should not carry distractor intent or misconception tags.' });
    }
    const distractorIntentValues = incorrectOptionIds
      .map((id) => text(metadataByOption.get(id)?.distractorIntent).toLowerCase())
      .filter(Boolean);
    const duplicateDistractorIntent = new Set(distractorIntentValues).size !== distractorIntentValues.length;
    if (duplicateDistractorIntent) {
      issues.push({ code: 'duplicate_distractor_intent', severity: 'warning', message: 'Incorrect options should not reuse the same distractor intent.' });
    }
    dimensions.push({
      key: 'distractor_quality',
      status: missingDistractorMetadata.length === 0 && !genericDistractorIds.length && !duplicateDistractorIntent ? 'passed' : 'warning',
      note: missingDistractorMetadata.length
        ? `Missing distractor metadata for ${missingDistractorMetadata.join(', ')}.`
        : genericDistractorIds.length
          ? `Generic distractor text found for ${genericDistractorIds.join(', ')}.`
          : duplicateDistractorIntent
            ? 'At least two incorrect options reuse the same distractor intent.'
            : 'Every incorrect option has distinct distractor metadata.'
    });
    if (candidate.questionType === 'single_choice' && hasCompoundSingleChoiceOption(candidate)) {
      issues.push({ code: 'compound_single_choice_option', severity: 'warning', message: 'Single-choice options should avoid all/both/none-of-the-above style compound answers unless explicitly reviewed.' });
    }
    if (candidate.subject === 'chemistry' && hasContaminatedChlorideInference(candidate)) {
      issues.push({
        code: 'chemistry_reagent_contamination_chloride_inference',
        severity: 'error',
        message: 'Ion-test evidence is contaminated: chloride-containing reagents were introduced before using AgNO3/AgCl evidence to infer original chloride.'
      });
    }
    const difficultyAllowed = !allowedDifficultyKeys.length || allowedDifficultyKeys.includes(candidateDifficultyKey);
    dimensions.push({
      key: 'difficulty_match',
      status: difficultyAllowed ? 'passed' : 'warning',
      note: difficultyAllowed ? 'Designed difficulty is allowed for this topic.' : 'Designed difficulty is outside the configured topic range.'
    });
    if (hasPromptLeakage(candidate)) {
      issues.push({ code: 'prompt_leakage', severity: 'error', message: 'Prompt or options contain answer leakage, placeholder text, or AI-generation wording.' });
    }
    dimensions.push({
      key: 'prompt_leakage',
      status: hasPromptLeakage(candidate) ? 'failed' : 'passed',
      note: hasPromptLeakage(candidate) ? 'Potential answer leakage or placeholder text was detected.' : 'No obvious answer leakage or placeholder text was detected.'
    });
    if (duplicatePromptCount > 0) {
      issues.push({ code: 'duplicate_prompt_risk', severity: 'warning', message: 'A highly similar or identical prompt already exists in the question bank.' });
    }
    if (duplicatePromptCount === 0 && nearDuplicateCount > 0) {
      issues.push({ code: 'near_duplicate_prompt_risk', severity: 'warning', message: 'A near-duplicate prompt already exists in the same topic question bank.' });
    }
    dimensions.push({
      key: 'duplicate_risk',
      status: duplicatePromptCount > 0 || nearDuplicateCount > 0 ? 'warning' : 'passed',
      note: duplicatePromptCount > 0
        ? `${duplicatePromptCount} existing prompt match(es) found in the question bank.`
        : nearDuplicateCount > 0
          ? `${nearDuplicateCount} near-duplicate prompt candidate(s) found in the same topic.`
          : 'No exact or near-duplicate prompt was found in the checked question bank.'
    });

    const domainNotes: string[] = [];
    let domainStatus: ReviewDimension['status'] = 'passed';
    const numericMismatch = answerExplanationNumericMismatch(candidate);
    if (numericMismatch) {
      issues.push({
        code: 'answer_explanation_numeric_mismatch',
        severity: 'error',
        message: `Explanation derives ${numericMismatch.resultValue}, which is closer to option ${numericMismatch.best.id} ("${text(numericMismatch.best.text)}") than declared option ${numericMismatch.declared.id} ("${text(numericMismatch.declared.text)}").`
      });
      domainStatus = 'failed';
      domainNotes.push(`Explanation-derived numeric result ${numericMismatch.resultValue} is closer to option ${numericMismatch.best.id} than the declared answer ${numericMismatch.declared.id}.`);
    }
    const subject = text(candidate.subject || context.subject).toLowerCase();
    if (subject === 'math') {
      const trueLogarithmDistractorId = simpleLogarithmTrueDistractor(candidate);
      if (trueLogarithmDistractorId) {
        issues.push({ code: 'math_logarithm_true_distractor_conflict', severity: 'error', message: `Simple-logarithm sanity check found that distractor ${trueLogarithmDistractorId} is also mathematically true.` });
        domainStatus = 'failed';
        domainNotes.push(`Simple logarithm evaluation found an additional true option at ${trueLogarithmDistractorId}.`);
      }
      const expected = inferLinearFunctionAnswer(candidate);
      if (expected !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = numericValue(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = numericValue(option.text);
          return value !== null && sameNumber(value, expected);
        });
        if (correctValue === null || !sameNumber(correctValue, expected)) {
          issues.push({ code: 'math_linear_function_answer_mismatch', severity: 'error', message: `Linear-function sanity check expected ${expected}, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Linear function check expected ${expected}, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'math_linear_function_option_conflict', severity: 'error', message: 'Linear-function sanity check found the computed answer under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed answer appears under a different or repeated option.');
        } else {
          domainNotes.push('Linear-function numeric answer matched the declared correct option.');
        }
      }
      const expectedSequenceTerm = inferArithmeticSequenceAnswer(candidate);
      if (expectedSequenceTerm !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = numericValue(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = numericValue(option.text);
          return value !== null && sameNumber(value, expectedSequenceTerm);
        });
        if (correctValue === null || !sameNumber(correctValue, expectedSequenceTerm)) {
          issues.push({ code: 'math_arithmetic_sequence_answer_mismatch', severity: 'error', message: `Arithmetic-sequence sanity check expected ${expectedSequenceTerm}, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Arithmetic sequence check expected ${expectedSequenceTerm}, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'math_arithmetic_sequence_option_conflict', severity: 'error', message: 'Arithmetic-sequence sanity check found the computed answer under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed arithmetic-sequence answer appears under a different or repeated option.');
        } else {
          domainNotes.push('Arithmetic-sequence numeric answer matched the declared correct option.');
        }
      }
      const expectedEquationSolution = inferLinearEquationSolution(candidate);
      if (expectedEquationSolution !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = leadingNumericValue(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = leadingNumericValue(option.text);
          return value !== null && sameNumber(value, expectedEquationSolution);
        });
        if (correctValue === null || !sameNumber(correctValue, expectedEquationSolution)) {
          issues.push({ code: 'math_linear_equation_answer_mismatch', severity: 'error', message: `Linear-equation sanity check expected ${expectedEquationSolution}, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Linear equation check expected ${expectedEquationSolution}, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'math_linear_equation_option_conflict', severity: 'error', message: 'Linear-equation sanity check found the computed solution under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed linear-equation solution appears under a different or repeated option.');
        } else {
          domainNotes.push('Linear-equation solution matched the declared correct option.');
        }
      }
    }
    if (subject === 'physics') {
      if (physicsElectricFieldDeflectionAxisConflict(candidate)) {
        issues.push({
          code: 'physics_field_deflection_axis_conflict',
          severity: 'error',
          message: 'Electric-field direction and requested deflection axis are inconsistent: a horizontal electric field does not cause vertical deflection without another vertical force source.'
        });
        domainStatus = 'failed';
        domainNotes.push('Horizontal electric field with horizontal initial velocity cannot explain a vertical offset unless another vertical force is stated.');
      }
      if (physicsPotentialEnergySignConflict(candidate)) {
        issues.push({
          code: 'physics_potential_energy_sign_conflict',
          severity: 'error',
          message: 'Potential-energy sign conflicts with electric-field direction: for a positive charge moving along the electric field, electric potential energy should decrease.'
        });
        domainStatus = 'failed';
        domainNotes.push('Positive charge moving along the electric field should have decreasing electric potential energy; prompt/explanation claimed the opposite sign.');
      }
      const expectedUnits = likelyPhysicsExpectedUnits(candidate);
      if (expectedUnits.length) {
        const correctText = correctOptionText(candidate);
        const unitBearingOptions = candidate.options.filter((option) => optionHasUnit(option.text, expectedUnits));
        if (!optionHasUnit(correctText, expectedUnits) && unitBearingOptions.length > 0) {
          issues.push({ code: 'physics_unit_mismatch', severity: 'warning', message: `Correct option should use the expected unit family (${expectedUnits[0]}).` });
          if (domainStatus !== 'failed') domainStatus = 'warning';
          domainNotes.push(`Expected unit family ${expectedUnits[0]} was missing from the declared correct option.`);
        } else {
          domainNotes.push(`Physics unit sanity check found expected unit family ${expectedUnits[0]}.`);
        }
      }
      const expectedSpeed = inferPhysicsSpeedAnswer(candidate);
      if (expectedSpeed !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = leadingNumericValue(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = leadingNumericValue(option.text);
          return value !== null && sameNumber(value, expectedSpeed);
        });
        if (correctValue === null || !sameNumber(correctValue, expectedSpeed)) {
          issues.push({ code: 'physics_speed_answer_mismatch', severity: 'error', message: `Speed sanity check expected ${expectedSpeed} m/s, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Speed calculation expected ${expectedSpeed} m/s, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'physics_speed_option_conflict', severity: 'error', message: 'Speed sanity check found the computed value under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed speed appears under a different or repeated option.');
        } else {
          domainNotes.push('Speed calculation matched the declared correct option.');
        }
      }
      const expectedAcceleration = inferPhysicsAccelerationAnswer(candidate);
      if (expectedAcceleration !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = leadingNumericValue(correctText);
        const normalizedCorrectValue = correctValue === null ? null : correctValue * accelerationValueMultiplier(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = leadingNumericValue(option.text);
          return value !== null && sameNumber(value * accelerationValueMultiplier(option.text), expectedAcceleration);
        });
        if (normalizedCorrectValue === null || !sameNumber(normalizedCorrectValue, expectedAcceleration)) {
          issues.push({ code: 'physics_acceleration_answer_mismatch', severity: 'error', message: `Acceleration sanity check expected ${expectedAcceleration} m/s^2, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Acceleration calculation expected ${expectedAcceleration} m/s^2, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'physics_acceleration_option_conflict', severity: 'error', message: 'Acceleration sanity check found the computed value under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed acceleration appears under a different or repeated option.');
        } else {
          domainNotes.push('Acceleration calculation matched the declared correct option.');
        }
      }
      const expectedDensity = inferPhysicsDensityAnswer(candidate);
      if (expectedDensity !== null) {
        const correctText = correctOptionText(candidate);
        const correctValue = leadingNumericValue(correctText);
        const normalizedCorrectValue = correctValue === null ? null : correctValue * densityValueMultiplier(correctText);
        const matchingOptions = candidate.options.filter((option) => {
          const value = leadingNumericValue(option.text);
          return value !== null && sameNumber(value * densityValueMultiplier(option.text), expectedDensity);
        });
        if (normalizedCorrectValue === null || !sameNumber(normalizedCorrectValue, expectedDensity)) {
          issues.push({ code: 'physics_density_answer_mismatch', severity: 'error', message: `Density sanity check expected ${expectedDensity} kg/m^3, but the declared correct option is "${correctText}".` });
          domainStatus = 'failed';
          domainNotes.push(`Density calculation expected ${expectedDensity} kg/m^3, but declared answer text did not match.`);
        } else if (matchingOptions.length !== 1 || matchingOptions[0]?.id !== candidate.correctAnswer) {
          issues.push({ code: 'physics_density_option_conflict', severity: 'error', message: 'Density sanity check found the computed value under a different or repeated option.' });
          domainStatus = 'failed';
          domainNotes.push('Computed density appears under a different or repeated option.');
        } else {
          domainNotes.push('Density calculation matched the declared correct option.');
        }
      }
    }
    if (subject === 'chemistry') {
      const unbalanced = unbalancedChemicalEquations([candidate.prompt, candidate.explanation].join(' '));
      if (unbalanced.length) {
        issues.push({ code: 'chemistry_unbalanced_equation', severity: 'error', message: `Chemical equation sanity check found unbalanced equation(s): ${unbalanced.slice(0, 2).join('; ')}.` });
        domainStatus = 'failed';
        domainNotes.push('At least one displayed chemical equation is not atom-balanced.');
      }
      if (underdeterminedEquilibriumTemperatureInference(candidate)) {
        issues.push({
          code: 'chemistry_equilibrium_temperature_inference_underdetermined',
          severity: 'error',
          message: 'Equilibrium-constant change alone cannot uniquely determine both reaction heat effect and whether temperature increased or decreased.'
        });
        domainStatus = 'failed';
        domainNotes.push('Equilibrium thermodynamics inference is underdetermined without a stated temperature direction or known heat effect.');
      }
      if (chemistryEquilibriumPressureDirectionConflict(candidate)) {
        issues.push({
          code: 'chemistry_equilibrium_pressure_direction_conflict',
          severity: 'error',
          message: 'Equilibrium pressure/volume shift conflicts with the gas stoichiometry shown in the reversible reaction.'
        });
        domainStatus = 'failed';
        domainNotes.push('Compression/pressure shift direction conflicts with the displayed gas mole-count change.');
      }
      if (endorsedIronCombustionProductConflict(candidate)) {
        issues.push({
          code: 'chemistry_iron_combustion_product_conflict',
          severity: 'error',
          message: 'Iron burning in oxygen should not be auto-published as producing Fe2O3/red-brown ferric oxide; the standard school reaction produces Fe3O4/black solid.'
        });
        domainStatus = 'failed';
        domainNotes.push('Iron-in-oxygen combustion product was endorsed as ferric oxide instead of the standard magnetite product.');
      }
    }
    dimensions.push({
      key: 'domain_sanity',
      status: domainStatus,
      note: domainNotes.length ? domainNotes.join(' ') : 'No deterministic math/physics/chemistry sanity rule was triggered.'
    });

    const hasError = issues.some((issue) => issue.severity === 'error');
    return {
      status: hasError ? 'failed' : issues.length ? 'needs_review' : 'passed',
      issues,
      dimensions,
      sources: ['deterministic'],
      checkedAt: new Date().toISOString()
    };
  }
}
