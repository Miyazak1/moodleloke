import { BadRequestException } from '@nestjs/common';

export function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

export function assertPositiveInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new BadRequestException(message);
  }
  return Number(value);
}

export function assertNonNegativeInteger(value: unknown, message: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new BadRequestException(message);
  }
  return Number(value);
}

export function assertEnumValue<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  if (!allowed.includes(value as T)) {
    throw new BadRequestException(message);
  }
  return value as T;
}

export function cleanOptionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

export function assertRequiredString(value: unknown, message: string, maxLength?: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(message);
  }
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

export function cleanNullableString(value: unknown, message: string, maxLength?: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (maxLength && trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

export function assertEmail(value: unknown, message = '请输入有效邮箱。'): string {
  const email = assertRequiredString(value, message, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException(message);
  }
  return email;
}

export function assertPassword(value: unknown, minLength: number, message: string): string {
  if (typeof value !== 'string' || value.length < minLength) {
    throw new BadRequestException(message);
  }
  return value;
}

export function assertOptionalUrl(value: unknown, message: string): string | null | undefined {
  const cleaned = cleanNullableString(value, message, 2048);
  if (!cleaned) return cleaned;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new BadRequestException(message);
  }
  return cleaned;
}

export function assertActorId(value: unknown): number {
  return assertPositiveInteger(value, '缺少后台操作人。');
}
