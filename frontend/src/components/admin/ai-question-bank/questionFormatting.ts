export function metadataText(value: unknown, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function subjectDisplayName(subject: string) {
  const labels: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学'
  };
  return labels[subject] ?? subject;
}

export function gateLabel(decision: string) {
  const labels: Record<string, string> = {
    publishable: '门禁通过',
    quality_attention: '质量关注',
    human_review: '质量关注',
    manual_override_publishable: '质量关注后可入库',
    regenerate: '建议重生',
    needs_edit: '需先修改',
    unknown: '待复审'
  };
  return labels[decision] ?? decision;
}

export function sourceSimilarityText(value: number | null) {
  if (value === null) return '未检查';
  return `${Math.round(value * 100)}%`;
}
