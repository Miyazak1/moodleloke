// Explicit compatibility bindings. Keep host IDs/codes and bank relations intact.
// Never infer a binding from translated titles or numeric database IDs.
export function verifiedMathEngineTopicCode(hostTopicCode: string): string {
  return hostTopicCode === 'math-solid-geometry' ? 'M-GEO-002' : hostTopicCode;
}
