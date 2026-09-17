import { useI18n } from '../i18n/useI18n';

export function ErrorBanner({ message }: { message: string | null }) {
  const { t } = useI18n();

  if (!message) {
    return null;
  }

  return (
    <div className="error-banner" role="alert">
      <strong>{t('common.errorBannerTitle', '当前操作失败')}</strong>
      <p>{message}</p>
    </div>
  );
}
