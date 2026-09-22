import { useRef, useState, type ReactNode } from 'react';
import { recordAgentTeachingInteraction, type AgentTeachingAsset, type AgentTeachingInteractionResult } from '../../../lib/api-agent';

function requestId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function curvePath(shift: number) {
  const points: string[] = [];
  for (let x = -5; x <= 5; x += 0.1) {
    const y = (x - shift) ** 2;
    if (y <= 6) points.push(`${160 + x * 28},${170 - y * 24}`);
  }
  return points.join(' ');
}

type TeachingAction = 'opened' | 'parameter_changed' | 'active_prompt_answered' | 'completed' | 'skipped';
type Props = {
  asset: AgentTeachingAsset;
  roundId?: number;
  questionId?: number;
  recordInteraction?: (input: { clientRequestId: string; action: Exclude<TeachingAction, 'skipped'>; value?: string | number | boolean }) => Promise<AgentTeachingInteractionResult>;
  onCompleted?: () => Promise<void> | void;
  interactiveContent?: ReactNode;
};

function InteractiveModel({ asset, onParameterChanged }: { asset: AgentTeachingAsset; onParameterChanged: (value: string) => void }) {
  const component = asset.component;
  const [shift, setShift] = useState(component.key === 'math.function-horizontal-shift' ? component.props.initialShift : 0);
  const [force, setForce] = useState(component.key === 'physics.newton-second-law' ? component.props.initialForce : 8);
  const [mass, setMass] = useState(component.key === 'physics.newton-second-law' ? component.props.initialMass : 2);
  const [acid, setAcid] = useState(component.key === 'chemistry.acid-base-neutralization' ? component.props.initialAcid : 6);
  const [base, setBase] = useState(component.key === 'chemistry.acid-base-neutralization' ? component.props.initialBase : 4);

  if (component.key === 'physics.newton-second-law') {
    const acceleration = force / mass;
    return <div className="agent-micro-graph agent-micro-newton">
      <div className="agent-micro-formula">a = F / m = {acceleration.toFixed(1)} m/s²</div>
      <div className="agent-newton-stage" role="img" aria-label={`Force ${force} newtons, mass ${mass} kilograms, acceleration ${acceleration.toFixed(1)} meters per second squared`}>
        <span className="agent-newton-block" style={{ width: `${54 + mass * 7}px` }}>{mass.toFixed(1)} kg</span>
        <span className="agent-newton-force" style={{ width: `${Math.min(72, force * 3)}%` }}>F = {force.toFixed(0)} N →</span>
        <span className="agent-newton-acceleration">a = {acceleration.toFixed(1)} m/s²</span>
      </div>
      <label><span>合力 F</span><input type="range" min={component.props.forceMin} max={component.props.forceMax} step="1" value={force} onChange={(event) => setForce(Number(event.target.value))} onPointerUp={() => onParameterChanged(`force:${force}`)} /><strong>{force} N</strong></label>
      <label><span>质量 m</span><input type="range" min={component.props.massMin} max={component.props.massMax} step="0.5" value={mass} onChange={(event) => setMass(Number(event.target.value))} onPointerUp={() => onParameterChanged(`mass:${mass}`)} /><strong>{mass} kg</strong></label>
    </div>;
  }

  if (component.key === 'chemistry.acid-base-neutralization') {
    const balance = acid - base;
    const state = balance > 0 ? '酸过量' : balance < 0 ? '碱过量' : '恰好中和';
    return <div className="agent-micro-graph agent-micro-neutralization">
      <div className="agent-micro-formula">n(H⁺) − n(OH⁻) = {balance > 0 ? '+' : ''}{balance}</div>
      <div className={`agent-neutralization-stage ${balance > 0 ? 'acidic' : balance < 0 ? 'basic' : 'neutral'}`} role="img" aria-label={`Acid amount ${acid}, base amount ${base}, result ${state}`}>
        <div><span>H⁺</span><i style={{ height: `${20 + acid * 6}px` }} /><b>{acid}</b></div><strong>＋</strong>
        <div><span>OH⁻</span><i style={{ height: `${20 + base * 6}px` }} /><b>{base}</b></div><em>→ {state}</em>
      </div>
      <label><span>H⁺ 份数</span><input type="range" min={component.props.acidMin} max={component.props.acidMax} step="1" value={acid} onChange={(event) => setAcid(Number(event.target.value))} onPointerUp={() => onParameterChanged(`acid:${acid}`)} /><strong>{acid}</strong></label>
      <label><span>OH⁻ 份数</span><input type="range" min={component.props.baseMin} max={component.props.baseMax} step="1" value={base} onChange={(event) => setBase(Number(event.target.value))} onPointerUp={() => onParameterChanged(`base:${base}`)} /><strong>{base}</strong></label>
    </div>;
  }

  return <div className="agent-micro-graph">
    <div className="agent-micro-formula">y = (x {shift >= 0 ? '−' : '+'} {Math.abs(shift)})²</div>
    <svg viewBox="0 0 320 210" role="img" aria-label={`函数顶点位于 ${shift}, 0`}>
      <line x1="20" y1="170" x2="305" y2="170" /><line x1="160" y1="15" x2="160" y2="195" />
      <polyline points={curvePath(0)} className="original" /><polyline points={curvePath(shift)} className="shifted" />
      <circle cx={160 + shift * 28} cy="170" r="5" /><text x={168 + shift * 28} y="162">({shift}, 0)</text>
    </svg>
    <label><span>水平参数 h</span><input type="range" min={component.props.shiftMin} max={component.props.shiftMax} step="1" value={shift} onChange={(event) => setShift(Number(event.target.value))} onPointerUp={() => onParameterChanged(`shift:${shift}`)} /><strong>{shift}</strong></label>
  </div>;
}

export function TeachingAssetMicroLesson({ asset, roundId, questionId, recordInteraction, onCompleted, interactiveContent }: Props) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completionRequestId = useRef(requestId('teaching-completed'));

  async function record(action: TeachingAction, value?: string | number | boolean) {
    const clientRequestId = action === 'completed' ? completionRequestId.current : requestId(`teaching-${action}`);
    if (recordInteraction && action !== 'skipped') return recordInteraction({ clientRequestId, action, value });
    if (!roundId || !questionId) throw new Error('Teaching context is missing.');
    return recordAgentTeachingInteraction(asset.versionId, { clientRequestId, roundId, questionId, action, value });
  }
  async function start() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await record('opened'); setOpen(true); } catch { setError('微课暂时无法打开，请稍后重试。'); } finally { setBusy(false); }
  }
  async function checkAnswer() {
    if (!answer || busy) return;
    setBusy(true); setError(null);
    try { const result = await record('active_prompt_answered', answer); setFeedback({ correct: result.correct === true, text: result.feedback ?? '' }); }
    catch { setError('即时检查暂时无法提交。'); } finally { setBusy(false); }
  }
  async function complete() {
    if (!feedback?.correct || busy) return;
    setBusy(true); setError(null);
    try { await record('completed'); await onCompleted?.(); setCompleted(true); } catch { setError('完成状态暂时无法保存。'); } finally { setBusy(false); }
  }

  if (!open) return <section className="agent-micro-lesson-card"><div><span>交互微课 · 约 {asset.estimatedMinutes} 分钟</span><strong>{asset.title}</strong><p>{asset.summary}</p></div><button type="button" onClick={() => void start()} disabled={busy}>{busy ? '正在打开…' : '开始讲解'}</button>{error && <small role="alert">{error}</small>}</section>;
  return <section className="agent-micro-lesson" aria-label={asset.title}>
    <header><div><span>交互微课 · {asset.topicTitle}</span><h3>{asset.title}</h3><p>{asset.summary}</p></div><b>已审核内容 v{asset.version}</b></header>
    <div className="agent-micro-lesson-body">
      {interactiveContent ?? <InteractiveModel asset={asset} onParameterChanged={(value) => void record('parameter_changed', value)} />}
      <div className="agent-micro-guide"><ol>{asset.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol><fieldset><legend>{asset.activePrompt.prompt}</legend>{asset.activePrompt.options.map((option) => <label key={option.id}><input type="radio" name={`asset-${asset.versionId}`} value={option.id} checked={answer === option.id} onChange={() => { setAnswer(option.id); setFeedback(null); }} /><span>{option.label}</span></label>)}</fieldset><button type="button" className="agent-micro-secondary" onClick={() => void checkAnswer()} disabled={!answer || busy}>检查我的判断</button>{feedback && <p className={feedback.correct ? 'agent-micro-feedback correct' : 'agent-micro-feedback wrong'}>{feedback.text}</p>}<button type="button" className="agent-micro-complete" onClick={() => void complete()} disabled={!feedback?.correct || busy || completed}>{completed ? '已完成，后续会安排独立验证' : '我理解了，完成微课'}</button><small>完成微课本身不会提高掌握度；系统会用后续新题验证。</small>{error && <p className="agent-micro-error" role="alert">{error}</p>}</div>
    </div>
  </section>;
}

export const FunctionShiftMicroLesson = TeachingAssetMicroLesson;
