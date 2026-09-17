import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type AdminFormFieldProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AdminFormField({ label, children, className = '' }: AdminFormFieldProps) {
  return (
    <label className={['admin-form-field', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

type StatusPillTone = 'success' | 'muted' | 'warning' | 'danger';

type StatusPillProps = {
  children: ReactNode;
  tone: StatusPillTone;
  className?: string;
};

export function StatusPill({ children, tone, className = '' }: StatusPillProps) {
  return <span className={['status-pill', tone, className].filter(Boolean).join(' ')}>{children}</span>;
}

type GhostButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function GhostButton({ className = '', type = 'button', ...props }: GhostButtonProps) {
  return <button type={type} className={['ghost', className].filter(Boolean).join(' ')} {...props} />;
}

type InlineActionsProps = HTMLAttributes<HTMLDivElement>;

export function InlineActions({ className = '', ...props }: InlineActionsProps) {
  return <div className={['inline-actions', className].filter(Boolean).join(' ')} {...props} />;
}

type MetricCardProps = HTMLAttributes<HTMLElement> & {
  label: ReactNode;
  value: ReactNode;
  children?: ReactNode;
};

export function MetricCard({ label, value, children, className = '', ...props }: MetricCardProps) {
  return (
    <article className={className} {...props}>
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </article>
  );
}

type SurfaceCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
};

export function SurfaceCard({ as = 'article', className = '', ...props }: SurfaceCardProps) {
  if (as === 'section') return <section className={className} {...props} />;
  if (as === 'div') return <div className={className} {...props} />;
  return <article className={className} {...props} />;
}
