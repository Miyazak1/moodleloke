export function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function numberFromRecord(record: Record<string, unknown>, key: string) {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : 0;
}

export function questionOptionsFromUnknown(value: unknown) {
  return Array.isArray(value)
    ? value
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => item as { id?: unknown; text?: unknown })
      .map((item) => ({
        id: String(item.id ?? '').trim(),
        text: String(item.text ?? '').trim()
      }))
      .filter((item) => item.id || item.text)
    : [];
}
