const startedAt = new Date();

type MetricsSnapshot = {
  appVersion: string;
  startedAt: string;
  uptimeSeconds: number;
  latencyBucketsMs: Record<string, number>;
  requests: {
    total: number;
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
    unauthorized: number;
    forbidden: number;
    averageDurationMs: number;
  };
};

const latencyBucketBounds = [100, 250, 500, 1000, 2500, 5000];
const counters = {
  total: 0,
  status2xx: 0,
  status3xx: 0,
  status4xx: 0,
  status5xx: 0,
  unauthorized: 0,
  forbidden: 0,
  totalDurationMs: 0
};
const latencyBuckets = new Map<string, number>(latencyBucketBounds.map((bound) => [String(bound), 0]));
latencyBuckets.set('+Inf', 0);

export function isMetricsEnabled() {
  return process.env.OPS_METRICS_ENABLED === 'true';
}

export function getAppVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || '0.1.0';
}

export function getCspMode() {
  const mode = process.env.CSP_MODE?.toLowerCase();
  if (mode === 'enforce') return 'enforce';
  if (mode === 'off') return 'off';
  return 'report-only';
}

export function recordRequestMetrics(statusCode: number, durationMs: number) {
  counters.total += 1;
  counters.totalDurationMs += durationMs;
  for (const bound of latencyBucketBounds) {
    if (durationMs <= bound) latencyBuckets.set(String(bound), (latencyBuckets.get(String(bound)) ?? 0) + 1);
  }
  latencyBuckets.set('+Inf', (latencyBuckets.get('+Inf') ?? 0) + 1);
  if (statusCode >= 500) counters.status5xx += 1;
  else if (statusCode >= 400) counters.status4xx += 1;
  else if (statusCode >= 300) counters.status3xx += 1;
  else if (statusCode >= 200) counters.status2xx += 1;
  if (statusCode === 401) counters.unauthorized += 1;
  if (statusCode === 403) counters.forbidden += 1;
}

export function getMetricsSnapshot(): MetricsSnapshot {
  return {
    appVersion: getAppVersion(),
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    latencyBucketsMs: Object.fromEntries(latencyBuckets.entries()),
    requests: {
      total: counters.total,
      status2xx: counters.status2xx,
      status3xx: counters.status3xx,
      status4xx: counters.status4xx,
      status5xx: counters.status5xx,
      unauthorized: counters.unauthorized,
      forbidden: counters.forbidden,
      averageDurationMs: counters.total ? Math.round(counters.totalDurationMs / counters.total) : 0
    }
  };
}

export function getMetricsPrometheusText() {
  const snapshot = getMetricsSnapshot();
  const lines = [
    '# HELP cscalite_requests_total Total HTTP requests observed by the CSCAPilot process.',
    '# TYPE cscalite_requests_total counter',
    `cscalite_requests_total ${snapshot.requests.total}`,
    '# HELP cscalite_requests_status_total HTTP requests by status family.',
    '# TYPE cscalite_requests_status_total counter',
    `cscalite_requests_status_total{family="2xx"} ${snapshot.requests.status2xx}`,
    `cscalite_requests_status_total{family="3xx"} ${snapshot.requests.status3xx}`,
    `cscalite_requests_status_total{family="4xx"} ${snapshot.requests.status4xx}`,
    `cscalite_requests_status_total{family="5xx"} ${snapshot.requests.status5xx}`,
    `cscalite_requests_status_total{family="401"} ${snapshot.requests.unauthorized}`,
    `cscalite_requests_status_total{family="403"} ${snapshot.requests.forbidden}`,
    '# HELP cscalite_request_duration_ms_bucket Cumulative request duration buckets in milliseconds.',
    '# TYPE cscalite_request_duration_ms_bucket histogram',
    ...Object.entries(snapshot.latencyBucketsMs).map(([le, count]) => `cscalite_request_duration_ms_bucket{le="${le}"} ${count}`),
    `cscalite_request_duration_ms_count ${snapshot.requests.total}`,
    `cscalite_request_duration_ms_sum ${counters.totalDurationMs}`,
    '# HELP cscalite_uptime_seconds Process uptime in seconds.',
    '# TYPE cscalite_uptime_seconds gauge',
    `cscalite_uptime_seconds ${snapshot.uptimeSeconds}`,
    ''
  ];
  return lines.join('\n');
}
