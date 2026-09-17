import { ApiError } from '../../../lib/request';

export function formatDate(value: string | null, emptyLabel = '还没有练习记录') {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function compactError(error: unknown) {
  if (error instanceof ApiError) {
    const code = error.code ? `/${error.code}` : '';
    return `HTTP ${error.status}${code}：${error.message}`;
  }
  return error instanceof Error ? error.message : '操作失败。';
}

export function isForbiddenLikeError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403 || error.code === 'unauthorized' || error.code === 'forbidden';
  }
  const message = compactError(error).toLowerCase();
  return message.includes('403')
    || message.includes('forbidden')
    || message.includes('unauthorized');
}

export function summarizeSettledFailures(
  results: ReadonlyArray<PromiseSettledResult<unknown>>,
  labels: ReadonlyArray<string>
) {
  const failures = results.flatMap((result, index) => {
    if (result.status !== 'rejected') return [];
    const label = labels[index] ?? `模块 ${index + 1}`;
    return [{
      label,
      detail: `${label}：${compactError(result.reason)}`,
      reason: result.reason
    }];
  });

  return {
    labels: failures.map((failure) => failure.label),
    details: failures.map((failure) => failure.detail),
    hasForbiddenFailure: failures.some((failure) => isForbiddenLikeError(failure.reason))
  };
}

export function formatSettledFailureMessage(
  failureSummary: ReturnType<typeof summarizeSettledFailures>,
  options: {
    scope: string;
    retryHint?: string;
  }
) {
  if (failureSummary.labels.length === 0) return null;

  const visibleLabels = failureSummary.labels.slice(0, 5).join('、');
  const hiddenCount = failureSummary.labels.length - 5;
  const moduleText = hiddenCount > 0
    ? `${visibleLabels} 等 ${failureSummary.labels.length} 个模块`
    : visibleLabels;
  const retryHint = options.retryHint ?? '可稍后刷新重试。';

  if (failureSummary.hasForbiddenFailure) {
    return `${options.scope}读取受限：当前登录态不可用、账号未验证，或账号缺少管理员权限。受影响模块：${moduleText}。请重新登录管理员账号；如果刚调整权限，刷新后再试。`;
  }

  return `${options.scope}部分模块暂时无法加载：${moduleText}。已加载内容仍可使用，${retryHint}`;
}

export function prettyJson(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback, null, 2);
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled';
}
