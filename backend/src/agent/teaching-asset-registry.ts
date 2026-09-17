export const TEACHING_ASSET_CAPABILITIES = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false }
} as const;

export type TeachingAssetCapabilityKey = keyof typeof TEACHING_ASSET_CAPABILITIES;

export function getTeachingAssetCapability(componentKey: string, componentVersion: string) {
  return TEACHING_ASSET_CAPABILITIES[(componentKey + '@' + componentVersion) as TeachingAssetCapabilityKey] ?? null;
}
