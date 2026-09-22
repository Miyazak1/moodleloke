import { lazy, Suspense, type ComponentType } from 'react';
import '../../styles/special-practice-visualizers.css';
import '../../styles/special-practice-visualizers-physics.css';
import '../../styles/special-practice-visualizers-chemistry.css';

type VisualizerProps = { onNavigate: (path: string) => void };
type VisualizerComponent = ComponentType<VisualizerProps>;

const math = (name: string) => lazy(async () => {
  const module = await import('../../pages/special-practice/MathVisualizers');
  return { default: module[name as keyof typeof module] as VisualizerComponent };
});
const chemistry = (name: string) => lazy(async () => {
  const module = await import('../../pages/special-practice/ChemistryVisualizers');
  return { default: module[name as keyof typeof module] as VisualizerComponent };
});
export const TEACHING_VISUALIZER_COMPONENTS: Record<string, VisualizerComponent> = {
  'visualizer.math.trigonometry': math('TrigVisualizerView'),
  'visualizer.math.function-transform': math('FunctionTransformVisualizerView'),
  'visualizer.math.elementary-functions': math('ElementaryFunctionsVisualizerView'),
  'visualizer.math.inequality-solutions': math('InequalitySolutionsVisualizerView'),
  'visualizer.math.sequence': math('SequenceVisualizerView'),
  'visualizer.math.probability': math('ProbabilityVisualizerView'),
  'visualizer.math.vector-operations': math('VectorOperationsVisualizerView'),
  'visualizer.math.conic-sections': math('ConicSectionsVisualizerView'),
  'visualizer.math.coordinate-geometry': math('CoordinateGeometryVisualizerView'),
  'visualizer.math.solid-geometry': math('SolidGeometryVisualizerView'),
  'visualizer.math.calculus': math('CalculusVisualizerView'),
  'visualizer.math.set-operations': math('SetOperationsVisualizerView'),
  'visualizer.physics.newton-second-law': lazy(() => import('../../pages/special-practice/PhysicsNewtonSecondLawVisualizerView').then((module) => ({ default: module.PhysicsNewtonSecondLawVisualizerView }))),
  'visualizer.physics.kinematics-graphs': lazy(() => import('../../pages/special-practice/PhysicsKinematicsGraphsVisualizerView').then((module) => ({ default: module.PhysicsKinematicsGraphsVisualizerView }))),
  'visualizer.physics.energy-conservation': lazy(() => import('../../pages/special-practice/PhysicsEnergyConservationVisualizerView').then((module) => ({ default: module.PhysicsEnergyConservationVisualizerView }))),
  'visualizer.physics.momentum-collision': lazy(() => import('../../pages/special-practice/PhysicsMomentumCollisionVisualizerView').then((module) => ({ default: module.PhysicsMomentumCollisionVisualizerView }))),
  'visualizer.physics.circular-motion': lazy(() => import('../../pages/special-practice/PhysicsCircularMotionVisualizerView').then((module) => ({ default: module.PhysicsCircularMotionVisualizerView }))),
  'visualizer.physics.wave-speed': lazy(() => import('../../pages/special-practice/PhysicsWaveSpeedVisualizerView').then((module) => ({ default: module.PhysicsWaveSpeedVisualizerView }))),
  'visualizer.physics.thin-lens': lazy(() => import('../../pages/special-practice/PhysicsThinLensVisualizerView').then((module) => ({ default: module.PhysicsThinLensVisualizerView }))),
  'visualizer.physics.double-slit': lazy(() => import('../../pages/special-practice/PhysicsDoubleSlitVisualizerView').then((module) => ({ default: module.PhysicsDoubleSlitVisualizerView }))),
  'visualizer.physics.electric-field': lazy(() => import('../../pages/special-practice/PhysicsElectricFieldVisualizerView').then((module) => ({ default: module.PhysicsElectricFieldVisualizerView }))),
  'visualizer.physics.circuit-series-parallel': lazy(() => import('../../pages/special-practice/PhysicsCircuitSeriesParallelVisualizerView').then((module) => ({ default: module.PhysicsCircuitSeriesParallelVisualizerView }))),
  'visualizer.physics.electromagnetic-induction': lazy(() => import('../../pages/special-practice/PhysicsElectromagneticInductionVisualizerView').then((module) => ({ default: module.PhysicsElectromagneticInductionVisualizerView }))),
  'visualizer.physics.magnetic-force': lazy(() => import('../../pages/special-practice/PhysicsMagneticForceVisualizerView').then((module) => ({ default: module.PhysicsMagneticForceVisualizerView }))),
  'visualizer.physics.ideal-gas-law': lazy(() => import('../../pages/special-practice/PhysicsIdealGasLawVisualizerView').then((module) => ({ default: module.PhysicsIdealGasLawVisualizerView }))),
  'visualizer.physics.thermodynamics-first-law': lazy(() => import('../../pages/special-practice/PhysicsThermodynamicsFirstLawVisualizerView').then((module) => ({ default: module.PhysicsThermodynamicsFirstLawVisualizerView }))),
  'visualizer.physics.photoelectric-effect': lazy(() => import('../../pages/special-practice/PhysicsPhotoelectricEffectVisualizerView').then((module) => ({ default: module.PhysicsPhotoelectricEffectVisualizerView }))),
  'visualizer.chemistry.acid-base-neutralization': chemistry('AcidBaseNeutralizationVisualizerView'),
  'visualizer.chemistry.reaction-rate': chemistry('ChemistryReactionRateSimulatorView'),
  'visualizer.chemistry.redox-cell': chemistry('ChemistryRedoxCellSimulatorView'),
  'visualizer.chemistry.ph-titration': chemistry('ChemistryPhTitrationSimulatorView'),
  'visualizer.chemistry.atomic-periodic': chemistry('ChemistryAtomicPeriodicSimulatorView'),
  'visualizer.chemistry.bonding-structure': chemistry('ChemistryBondingStructureSimulatorView'),
  'visualizer.chemistry.ion-reaction': chemistry('ChemistryIonReactionSimulatorView'),
  'visualizer.chemistry.organic-hydrocarbon': chemistry('ChemistryOrganicHydrocarbonSimulatorView')
};

export function EmbeddedTeachingVisualizer({ componentKey }: { componentKey: string }) {
  const Visualizer = TEACHING_VISUALIZER_COMPONENTS[componentKey];
  if (!Visualizer) return null;
  return <div className="agent-micro-existing-visualizer"><Suspense fallback={<div className="agent-micro-visualizer-loading">正在加载交互模拟…</div>}><Visualizer onNavigate={() => undefined} /></Suspense></div>;
}
