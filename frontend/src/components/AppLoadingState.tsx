import { useI18n } from '../i18n/useI18n';
import '../styles/loading.css';

type AppLoadingStateProps = {
  variant?: 'admin' | 'auth' | 'page';
};

const COPY = {
  zh: {
    admin: ['管理工作区', '正在准备管理模块，首次打开后切换会更快。'],
    auth: ['正在确认身份', '正在安全地恢复你的登录状态。'],
    page: ['正在准备学习空间', '正在同步页面与学习记录。']
  },
  en: {
    admin: ['Admin workspace', 'Preparing this module. Future visits will be faster.'],
    auth: ['Confirming your account', 'Securely restoring your session.'],
    page: ['Preparing your workspace', 'Syncing the page and your learning progress.']
  },
  vi: {
    admin: ['Không gian quản trị', 'Đang chuẩn bị mô-đun. Những lần mở sau sẽ nhanh hơn.'],
    auth: ['Đang xác nhận tài khoản', 'Đang khôi phục phiên đăng nhập an toàn.'],
    page: ['Đang chuẩn bị không gian học', 'Đang đồng bộ trang và tiến độ học tập.']
  }
} as const;

export function AppLoadingState({ variant = 'page' }: AppLoadingStateProps) {
  const { locale } = useI18n();
  const language = locale === 'en' || locale === 'vi' ? locale : 'zh';
  const [title, detail] = COPY[language][variant];

  return (
    <section
      className={`app-loading-state app-loading-state-${variant}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-loading-message">
        <div className="app-loading-orbit" aria-hidden="true">
          <span className="app-loading-mark">CS</span>
          <i />
          <i />
        </div>
        <div className="app-loading-copy">
          <span>Moodlelike</span>
          <strong>{title}</strong>
          <p>{detail}</p>
          <div className="app-loading-dots" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </div>

      {variant === 'admin' ? (
        <div className="app-loading-admin-skeleton" aria-hidden="true">
          <div className="app-loading-skeleton-nav">
            <span className="wide" />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="app-loading-skeleton-content">
            <span className="eyebrow" />
            <span className="heading" />
            <span className="body" />
            <div className="app-loading-skeleton-cards"><span /><span /><span /></div>
            <span className="panel" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
