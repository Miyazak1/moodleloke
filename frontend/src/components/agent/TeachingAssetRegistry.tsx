import type { AgentTeachingAsset, AgentTeachingInteractionResult } from '../../lib/api-agent';
import { TeachingAssetMicroLesson } from '../../pages/special-practice/adaptive/FunctionShiftMicroLesson';

type TeachingAction = 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed';
export type TeachingAssetRendererProps = {
  asset: AgentTeachingAsset;
  roundId?: number;
  questionId?: number;
  recordInteraction?: (input: { clientRequestId: string; action: TeachingAction; value?: string | number | boolean }) => Promise<AgentTeachingInteractionResult>;
  onCompleted?: () => Promise<void> | void;
};

export const TEACHING_ASSET_REGISTRY = {
  'math.function-horizontal-shift@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true },
  'physics.newton-second-law@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true },
  'chemistry.acid-base-neutralization@1': { kind: 'interactive_simulation', surface: 'assistant', preservesPrimaryTask: true }
} as const;

export function teachingAssetRegistryKey(asset: AgentTeachingAsset) {
  return asset.component.key + '@' + asset.component.version;
}

export function TeachingAssetRenderer(props: TeachingAssetRendererProps) {
  const registryKey = teachingAssetRegistryKey(props.asset);
  const capability = TEACHING_ASSET_REGISTRY[registryKey as keyof typeof TEACHING_ASSET_REGISTRY];
  if (!capability) return <section className="agent-teaching-asset-fallback" role="status"><strong>{props.asset.title}</strong><p>{props.asset.summary}</p><small>该教学内容需要更新客户端后才能互动。当前任务不会被关闭。</small></section>;
  return <TeachingAssetMicroLesson {...props} />;
}
