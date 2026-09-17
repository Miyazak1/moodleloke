import { Component, type ErrorInfo, type ReactNode } from 'react';
import { routes } from '../lib/routes';

type AdminRouteErrorBoundaryProps = {
  children: ReactNode;
  enabled: boolean;
  routeKey: string;
  onBackAudit: () => void;
};

type AdminRouteErrorBoundaryState = {
  error: Error | null;
};

function errorMessage(error: Error | null) {
  if (!error) return '';
  return error.message || error.name || 'Unknown render error';
}

export class AdminRouteErrorBoundary extends Component<AdminRouteErrorBoundaryProps, AdminRouteErrorBoundaryState> {
  state: AdminRouteErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): AdminRouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminRouteErrorBoundary]', error, errorInfo);
  }

  componentDidUpdate(prevProps: AdminRouteErrorBoundaryProps) {
    if (prevProps.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.props.enabled || !this.state.error) {
      return this.props.children;
    }

    return (
      <div className="page-stack brand-page admin-work-page">
        <section className="school-empty-state">
          <strong>管理页暂时无法显示</strong>
          <p>
            当前管理模块渲染时出现异常，系统已经拦截，避免整个页面白屏。可以先重试当前页；如果仍失败，请返回后台总览或刷新浏览器。
          </p>
          <p>错误信息：{errorMessage(this.state.error)}</p>
          <div className="inline-actions">
            <button type="button" onClick={this.retry}>重试当前页</button>
            <button type="button" className="ghost" onClick={this.props.onBackAudit}>
              返回后台总览
            </button>
            <button type="button" className="ghost" onClick={this.reload}>
              刷新浏览器
            </button>
          </div>
        </section>
        {this.props.routeKey !== routes.adminAudit && (
          <section className="admin-feedback warning">
            <strong>后续定位</strong>
            <p>请把上面的错误信息和当前地址发给开发者，便于快速定位是数据结构、接口返回还是前端组件问题。</p>
          </section>
        )}
      </div>
    );
  }
}
