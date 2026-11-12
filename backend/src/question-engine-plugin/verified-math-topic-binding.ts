import type { MathCell, MathDifficulty } from './verified-math143.adapter';

// Match the existing host syllabus explicitly. Never infer from titles or IDs.
// A host topic may combine engine cells or cover only part of one engine cell.
const BINDINGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'math-function-basic': ['M-FUNC-002'],
  'math-function': ['M-FUNC-001'],
  'math-sequence': ['M-SEQ-001'],
  'math-calculus': ['M-CALC-001'],
  'math-plane-geometry': ['M-GEO-001'],
  'math-solid-vector': ['M-ALG-001'],
  'math-complex': ['M-ALG-001'],
  'math-solid-geometry': ['M-GEO-002'],
  'math-inequality': ['M-INEQ-001'],
  'math-set': ['M-SET-001'],
  'math-probability': ['M-PROB-001', 'M-STAT-001', 'M-STAT-002']
});

export function verifiedMathCellsForTopic(hostCode: string, difficulty: MathDifficulty, catalog: MathCell[]): MathCell[] {
  const codes = Object.prototype.hasOwnProperty.call(BINDINGS, hostCode) ? BINDINGS[hostCode] : [hostCode];
  const prefix = hostCode === 'math-solid-vector' ? 'vector_' : hostCode === 'math-complex' ? 'complex_' : null;
  return catalog.filter(cell => codes.includes(cell.topicCode) && cell.difficulty === difficulty).map(cell => ({
    ...cell,
    scopes: cell.scopes.filter(scope => !prefix || scope.id.split(':').slice(1).join(':').startsWith(prefix))
  })).filter(cell => cell.scopes.length > 0);
}

export function verifiedMathScopeMatches(hostCode: string, difficulty: MathDifficulty, cellId: string, scopeId: string, catalog: MathCell[]): boolean {
  return verifiedMathCellsForTopic(hostCode, difficulty, catalog)
    .some(cell => cell.id === cellId && cell.scopes.some(scope => scope.id === scopeId));
}

export function verifiedMathSeedLimit(scope: MathCell['scopes'][number]): number {
  if (scope.samplingMode === 'finite-stock-index' || scope.capacity > 0) return scope.capacity;
  return 2147483647;
}
