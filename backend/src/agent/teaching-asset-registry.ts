export const TEACHING_VISUALIZER_COMPONENT_KEYS = [
  'visualizer.math.trigonometry',
  'visualizer.math.function-transform',
  'visualizer.math.elementary-functions',
  'visualizer.math.inequality-solutions',
  'visualizer.math.sequence',
  'visualizer.math.probability',
  'visualizer.math.vector-operations',
  'visualizer.math.conic-sections',
  'visualizer.math.coordinate-geometry',
  'visualizer.math.solid-geometry',
  'visualizer.math.calculus',
  'visualizer.math.set-operations',
  'visualizer.physics.newton-second-law',
  'visualizer.physics.kinematics-graphs',
  'visualizer.physics.energy-conservation',
  'visualizer.physics.momentum-collision',
  'visualizer.physics.circular-motion',
  'visualizer.physics.wave-speed',
  'visualizer.physics.thin-lens',
  'visualizer.physics.double-slit',
  'visualizer.physics.electric-field',
  'visualizer.physics.circuit-series-parallel',
  'visualizer.physics.electromagnetic-induction',
  'visualizer.physics.magnetic-force',
  'visualizer.physics.ideal-gas-law',
  'visualizer.physics.thermodynamics-first-law',
  'visualizer.physics.photoelectric-effect',
  'visualizer.chemistry.acid-base-neutralization',
  'visualizer.chemistry.reaction-rate',
  'visualizer.chemistry.redox-cell',
  'visualizer.chemistry.ph-titration',
  'visualizer.chemistry.atomic-periodic',
  'visualizer.chemistry.bonding-structure',
  'visualizer.chemistry.ion-reaction',
  'visualizer.chemistry.organic-hydrocarbon'
] as const;

export const TEACHING_ASSET_COMPONENT_KEYS = [
  'math.function-horizontal-shift',
  'physics.newton-second-law',
  'chemistry.acid-base-neutralization',
  ...TEACHING_VISUALIZER_COMPONENT_KEYS
] as const;

const INTERACTIVE_SIMULATION_CAPABILITY = { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false } as const;

export const TEACHING_ASSET_CAPABILITIES: Record<string, typeof INTERACTIVE_SIMULATION_CAPABILITY> = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', renderer: 'interactive_component', surface: 'assistant', preservesPrimaryTask: true, completionChangesMastery: false },
  ...Object.fromEntries(TEACHING_VISUALIZER_COMPONENT_KEYS.map((key) => [`${key}@1`, INTERACTIVE_SIMULATION_CAPABILITY]))
};

export function getTeachingAssetCapability(componentKey: string, componentVersion: string) {
  return TEACHING_ASSET_CAPABILITIES[componentKey + '@' + componentVersion] ?? null;
}
