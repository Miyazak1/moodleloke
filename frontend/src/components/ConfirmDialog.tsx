import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { GhostButton, InlineActions } from './UiPrimitives';

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
  requiredText?: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'neutral',
  requiredText,
  isBusy = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const [confirmationText, setConfirmationText] = useState('');
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm', '确认');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel', '取消');
  const canConfirm = !requiredText || confirmationText === requiredText;

  useEffect(() => setConfirmationText(''), [requiredText]);

  useEffect(() => {
    (requiredText ? confirmationInputRef.current : confirmButtonRef.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, onCancel, requiredText]);

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isBusy) onCancel();
    }}>
      <section
        className={tone === 'danger' ? 'confirm-dialog confirm-dialog-danger' : 'confirm-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="page-kicker">{t('common.confirmDialogKicker', '操作确认')}</p>
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        {requiredText ? (
          <label className="confirm-dialog-verification">
            <span>{t('common.typeToConfirm', '请输入以下文字以确认：')} <strong>{requiredText}</strong></span>
            <input ref={confirmationInputRef} autoComplete="off" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} />
          </label>
        ) : null}
        <InlineActions>
          <button ref={confirmButtonRef} type="button" className={tone === 'danger' ? 'danger-action' : ''} onClick={onConfirm} disabled={isBusy || !canConfirm}>
            {isBusy ? t('common.processing', '处理中...') : resolvedConfirmLabel}
          </button>
          <GhostButton onClick={onCancel} disabled={isBusy}>
            {resolvedCancelLabel}
          </GhostButton>
        </InlineActions>
      </section>
    </div>
  );
}
