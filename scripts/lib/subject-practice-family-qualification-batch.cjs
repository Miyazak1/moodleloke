function scopeCounts(items) {
  const counts = {};
  for (const item of items) counts[item.scopeId] = Number(counts[item.scopeId] ?? 0) + 1;
  return counts;
}

function selectQualificationFamily(preflight, contract, samplesPerScope) {
  const family = preflight.families.find((item) => item.subject === contract.subject
    && item.taskFamily === contract.taskFamily
    && item.planTemplate === contract.planTemplate);
  if (!family || family.status !== 'batch_plan_ready') {
    return { status: family?.status ?? 'compatible_open_cell_missing', family: family ?? null, reasons: ['qualification_family_not_ready'] };
  }
  const counts = scopeCounts(family.items);
  const unexpectedScopes = Object.keys(counts).filter((scopeId) => !contract.expectedScopeIds.includes(scopeId));
  const missingOrImbalancedScopes = contract.expectedScopeIds.filter((scopeId) => counts[scopeId] !== samplesPerScope);
  const reasons = [];
  if (unexpectedScopes.length) reasons.push('qualification_scope_outside_contract');
  if (missingOrImbalancedScopes.length) reasons.push('qualification_scope_count_not_balanced');
  if (family.items.some((item) => !item.planValid)) reasons.push('qualification_question_plan_invalid');
  return {
    status: reasons.length ? 'qualification_batch_invalid' : 'qualification_batch_ready',
    family,
    scopeCounts: counts,
    unexpectedScopes,
    missingOrImbalancedScopes,
    reasons
  };
}

module.exports = { scopeCounts, selectQualificationFamily };
