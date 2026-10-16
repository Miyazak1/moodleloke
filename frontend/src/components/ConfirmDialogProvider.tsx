import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export type ConfirmDialogOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
  requiredText?: string;
};

type PendingConfirmation = ConfirmDialogOptions & {
  resolve: (confirmed: boolean) => void;
};

const ConfirmDialogContext = createContext<((options: ConfirmDialogOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => () => {
    pendingRef.current?.resolve(false);
  }, []);

  const requestConfirmation = useCallback((options: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    setPending((current) => {
      current?.resolve(false);
      return { ...options, resolve };
    });
  }), []);

  const settle = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const contextValue = useMemo(() => requestConfirmation, [requestConfirmation]);

  return (
    <ConfirmDialogContext.Provider value={contextValue}>
      {children}
      {pending ? (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          tone={pending.tone}
          requiredText={pending.requiredText}
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const requestConfirmation = useContext(ConfirmDialogContext);
  if (!requestConfirmation) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider.');
  return requestConfirmation;
}
