import { enMessages } from './en';
import { viMessages } from './vi';
import { zhCNMessages } from './zh-CN';
import type { Locale } from '../locales';

export const messages = {
  'zh-CN': zhCNMessages,
  en: enMessages,
  vi: viMessages
} as const;

export type MessageTree = typeof zhCNMessages;
export type MessageNamespace = keyof MessageTree;

export function readMessage(locale: Locale, key: string): string | undefined {
  if (!key) return undefined;
  const tree = messages[locale as keyof typeof messages] ?? messages['zh-CN'];
  const fallbackTree = messages['zh-CN'];
  return readFromTree(tree, key) ?? readFromTree(fallbackTree, key);
}

function readFromTree(tree: unknown, key: string): string | undefined {
  if (!key) return undefined;
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, tree) as string | undefined;
}
