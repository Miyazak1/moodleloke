import { useI18n } from '../i18n/useI18n';
import { GhostButton, InlineActions } from './UiPrimitives';

type ConfirmDialogProps = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
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
  isBusy = false,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm', '确认');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel', '取消');

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className={tone === 'danger' ? 'confirm-dialog confirm-dialog-danger' : 'confirm-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="page-kicker">{t('common.confirmDialogKicker', '操作确认')}</p>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{body}</p>
        <InlineActions>
          <button type="button" className={tone === 'danger' ? 'danger-action' : ''} onClick={onConfirm} disabled={isBusy}>
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
