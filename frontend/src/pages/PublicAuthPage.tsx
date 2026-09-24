import { FormEvent, useState, type CSSProperties } from 'react';
import { GhostButton, InlineActions } from '../components/UiPrimitives';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { forgotPassword, getMe, login, register, resendEmailVerification, resetPassword, startGoogleLogin } from '../lib/auth';
import '../styles/account.css';
import '../styles/content-typography.css';

type AuthMode = 'login' | 'register';
type AuthStep = AuthMode | 'forgot' | 'reset' | 'verify';

const GOOGLE_AUTH_ERROR_MESSAGES = {
  zh: {
    google_failed: 'Google 登录失败，请稍后重试。',
    google_denied: '你已取消 Google 登录。',
    account_disabled: '账号已停用，请联系管理员。',
    admin_google_binding_required: '管理员账号请先使用密码登录后再绑定 Google。',
    google_not_configured: 'Google 登录暂未配置。',
    google_email_unverified: 'Google 邮箱未验证，暂不能用于登录。',
    email_verification_failed: '邮箱验证链接无效或已过期，请登录后重新发送验证邮件。',
    fallback: '登录失败，请稍后重试。'
  },
  en: {
    google_failed: 'Google sign-in failed. Please try again later.',
    google_denied: 'You cancelled Google sign-in.',
    account_disabled: 'This account is disabled. Please contact an administrator.',
    admin_google_binding_required: 'Admin accounts need to log in with password before binding Google.',
    google_not_configured: 'Google sign-in is not configured yet.',
    google_email_unverified: 'This Google email is not verified yet.',
    email_verification_failed: 'The email verification link is invalid or expired. Log in and resend it.',
    fallback: 'Login failed. Please try again later.'
  },
  vi: {
    google_failed: 'Đăng nhập Google thất bại. Vui lòng thử lại sau.',
    google_denied: 'Bạn đã hủy đăng nhập Google.',
    account_disabled: 'Tài khoản này đã bị tạm dừng. Vui lòng liên hệ quản trị viên.',
    admin_google_binding_required: 'Tài khoản quản trị cần đăng nhập bằng mật khẩu trước khi liên kết Google.',
    google_not_configured: 'Đăng nhập Google chưa được cấu hình.',
    google_email_unverified: 'Email Google này chưa được xác minh.',
    email_verification_failed: 'Liên kết xác minh email không hợp lệ hoặc đã hết hạn. Hãy đăng nhập rồi gửi lại email xác minh.',
    fallback: 'Đăng nhập thất bại. Vui lòng thử lại sau.'
  }
} as const;

const AUTH_COPY = {
  zh: {
    kicker: '账号入口',
    loginTitle: '登录后继续你的 CSCA 路径。',
    registerTitle: '创建账号，保存你的备考进度。',
    body: '登录后可以保存模考记录、科目练习、错题复盘、学习计划和个人学习设置。',
    tabAria: '账号模式',
    login: '登录',
    register: '注册',
    google: '使用 Google 登录',
    divider: '或使用邮箱继续',
    email: '邮箱',
    password: '密码',
    confirmPassword: '确认密码',
    registerPlaceholder: '至少 8 位',
    passwordPlaceholder: '请输入密码',
    passwordHint: '至少 8 位，建议包含字母和数字。',
    missingPassword: '请输入密码。',
    shortPassword: '密码至少需要 8 位。',
    passwordMismatch: '两次输入的密码不一致。',
    forgotPassword: '忘记密码？',
    forgotTitle: '重置密码，继续回到备考进度。',
    forgotBody: '输入注册邮箱后，如果账号存在，我们会发送重置密码邮件。',
    forgotSubmit: '发送重置邮件',
    forgotSuccess: '如果这个邮箱存在，我们已经发送密码重置邮件。请检查收件箱。',
    resetTitle: '设置新的登录密码。',
    resetBody: '重置链接 30 分钟内有效。新密码至少 8 位。',
    resetSubmit: '重置密码',
    resetSuccess: '密码已重置，请使用新密码登录。',
    missingResetToken: '重置链接缺少 token，请重新发送密码重置邮件。',
    backToLogin: '返回登录',
    serviceUnavailable: '账号服务暂时不可用。',
    submitting: '处理中...',
    registerSubmit: '注册并进入',
    verifyTitle: '先确认邮箱，再完善学习档案。',
    verifyBody: '验证不是进入学习的硬门槛，但能确保你换设备后找回账号和学习记录。',
    verifyKicker: '邮箱确认',
    verifySent: '验证邮件已发送，请打开邮件中的链接完成验证。',
    verifyNotSent: '验证邮件暂时没有发出。你仍可继续设置学习档案，稍后再验证。',
    verifyCheck: '我已完成验证',
    verifyContinue: '暂不验证，继续设置',
    verifyResend: '重新发送',
    verifyPending: '暂未检测到验证结果，请完成邮件中的验证后再试。',
    verifyResent: '新的验证邮件已发送，请检查收件箱和垃圾邮件。',
    verifySendFailed: '验证邮件暂时无法发送，你可以先继续设置。',
    verifyChecking: '正在确认...',
    verifyResending: '发送中...',
    backHome: '返回首页',
    asideKicker: '登录后可做什么',
    asideTitle: '把模考、练习和错题复盘放在一起。',
    asideBody: '登录后，每次模考和科目练习都会回到同一条 CSCA 路径里。',
    asideItems: ['数学 4 题', '物理 4 题', '化学 4 题'],
    asideFootnote: '错题会进入下一组复盘'
  },
  en: {
    kicker: 'Account',
    loginTitle: 'Log in to continue your CSCA path.',
    registerTitle: 'Create an account to save your prep progress.',
    body: 'After logging in, you can save mock reports, subject practice, mistake review, learning plans, and personal learning settings.',
    tabAria: 'Account mode',
    login: 'Log in',
    register: 'Register',
    google: 'Continue with Google',
    divider: 'Or continue with email',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    registerPlaceholder: 'At least 8 characters',
    passwordPlaceholder: 'Enter password',
    passwordHint: 'At least 8 characters. Letters and numbers are recommended.',
    missingPassword: 'Please enter your password.',
    shortPassword: 'Password must be at least 8 characters.',
    passwordMismatch: 'The two passwords do not match.',
    forgotPassword: 'Forgot password?',
    forgotTitle: 'Reset your password and return to your prep.',
    forgotBody: 'Enter your account email. If it exists, we will send a password reset email.',
    forgotSubmit: 'Send reset email',
    forgotSuccess: 'If this email exists, a password reset email has been sent. Please check your inbox.',
    resetTitle: 'Set a new login password.',
    resetBody: 'The reset link is valid for 30 minutes. Use at least 8 characters.',
    resetSubmit: 'Reset password',
    resetSuccess: 'Password reset. Please log in with your new password.',
    missingResetToken: 'This reset link is missing its token. Please request a new reset email.',
    backToLogin: 'Back to login',
    serviceUnavailable: 'Account service is temporarily unavailable.',
    submitting: 'Processing...',
    registerSubmit: 'Register and continue',
    verifyTitle: 'Confirm your email, then set up your study profile.',
    verifyBody: 'Verification is not required to start learning, but it helps you recover your account and progress on another device.',
    verifyKicker: 'Email confirmation',
    verifySent: 'A verification email was sent. Open the link in that email to confirm your address.',
    verifyNotSent: 'The verification email could not be sent. You can continue setting up your profile and verify later.',
    verifyCheck: 'I have verified',
    verifyContinue: 'Continue without verifying',
    verifyResend: 'Resend email',
    verifyPending: 'We cannot confirm verification yet. Open the link in the email and try again.',
    verifyResent: 'A new verification email was sent. Check your inbox and spam folder.',
    verifySendFailed: 'The verification email could not be sent. You can continue for now.',
    verifyChecking: 'Checking...',
    verifyResending: 'Sending...',
    backHome: 'Back home',
    asideKicker: 'What login unlocks',
    asideTitle: 'Keep mocks, practice, and mistake review together.',
    asideBody: 'After login, every mock and subject set returns to one CSCA prep path.',
    asideItems: ['Math 4 Q', 'Physics 4 Q', 'Chemistry 4 Q'],
    asideFootnote: 'Mistakes flow into the next review set'
  },
  vi: {
    kicker: 'Tài khoản',
    loginTitle: 'Đăng nhập để tiếp tục lộ trình CSCA của bạn.',
    registerTitle: 'Tạo tài khoản để lưu tiến độ ôn tập.',
    body: 'Sau khi đăng nhập, bạn có thể lưu báo cáo thi thử, luyện theo môn, ôn câu sai, kế hoạch học tập và cài đặt học tập cá nhân.',
    tabAria: 'Chế độ tài khoản',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    google: 'Tiếp tục với Google',
    divider: 'Hoặc tiếp tục bằng email',
    email: 'Email',
    password: 'Mật khẩu',
    confirmPassword: 'Xác nhận mật khẩu',
    registerPlaceholder: 'Ít nhất 8 ký tự',
    passwordPlaceholder: 'Nhập mật khẩu',
    passwordHint: 'Ít nhất 8 ký tự. Nên gồm chữ cái và số.',
    missingPassword: 'Vui lòng nhập mật khẩu.',
    shortPassword: 'Mật khẩu cần ít nhất 8 ký tự.',
    passwordMismatch: 'Hai lần nhập mật khẩu không khớp.',
    forgotPassword: 'Quên mật khẩu?',
    forgotTitle: 'Đặt lại mật khẩu để quay lại tiến độ ôn tập.',
    forgotBody: 'Nhập email tài khoản. Nếu tài khoản tồn tại, chúng tôi sẽ gửi email đặt lại mật khẩu.',
    forgotSubmit: 'Gửi email đặt lại',
    forgotSuccess: 'Nếu email này tồn tại, email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.',
    resetTitle: 'Thiết lập mật khẩu đăng nhập mới.',
    resetBody: 'Liên kết đặt lại có hiệu lực trong 30 phút. Mật khẩu mới cần ít nhất 8 ký tự.',
    resetSubmit: 'Đặt lại mật khẩu',
    resetSuccess: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.',
    missingResetToken: 'Liên kết đặt lại thiếu token. Vui lòng yêu cầu gửi lại email đặt lại mật khẩu.',
    backToLogin: 'Quay lại đăng nhập',
    serviceUnavailable: 'Dịch vụ tài khoản tạm thời không khả dụng.',
    submitting: 'Đang xử lý...',
    registerSubmit: 'Đăng ký và tiếp tục',
    verifyTitle: 'Xác nhận email rồi thiết lập hồ sơ học tập.',
    verifyBody: 'Bạn không bắt buộc phải xác minh để bắt đầu học, nhưng bước này giúp khôi phục tài khoản và tiến độ trên thiết bị khác.',
    verifyKicker: 'Xác nhận email',
    verifySent: 'Email xác minh đã được gửi. Hãy mở liên kết trong email để xác nhận địa chỉ.',
    verifyNotSent: 'Tạm thời chưa gửi được email xác minh. Bạn vẫn có thể tiếp tục thiết lập hồ sơ và xác minh sau.',
    verifyCheck: 'Tôi đã xác minh',
    verifyContinue: 'Tiếp tục mà chưa xác minh',
    verifyResend: 'Gửi lại email',
    verifyPending: 'Chưa xác nhận được kết quả. Hãy mở liên kết trong email rồi thử lại.',
    verifyResent: 'Email xác minh mới đã được gửi. Hãy kiểm tra hộp thư đến và thư rác.',
    verifySendFailed: 'Tạm thời chưa gửi được email xác minh. Bạn có thể tiếp tục trước.',
    verifyChecking: 'Đang kiểm tra...',
    verifyResending: 'Đang gửi...',
    backHome: 'Về trang chủ',
    asideKicker: 'Đăng nhập để mở khóa',
    asideTitle: 'Gộp thi thử, luyện tập và ôn câu sai vào cùng một nơi.',
    asideBody: 'Sau khi đăng nhập, mỗi lần thi thử và luyện theo môn đều quay lại một lộ trình CSCA.',
    asideItems: ['Toán 4 câu', 'Vật lý 4 câu', 'Hóa học 4 câu'],
    asideFootnote: 'Câu sai đi vào nhóm ôn tiếp theo'
  }
} as const;

function getInitialAuthError(locale: string) {
  const error = new URLSearchParams(window.location.search).get('error');
  if (!error) return null;
  const messages = locale === 'vi' ? GOOGLE_AUTH_ERROR_MESSAGES.vi : locale === 'zh-CN' ? GOOGLE_AUTH_ERROR_MESSAGES.zh : GOOGLE_AUTH_ERROR_MESSAGES.en;
  return messages[error as keyof typeof messages] ?? messages.fallback;
}

function getInitialStep(initialMode: AuthMode): AuthStep {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === 'forgot' || mode === 'reset') return mode;
  return initialMode;
}

export function PublicAuthPage({
  initialMode,
  redirectTo,
  onBackHome,
  onGoToMe
}: {
  initialMode: AuthMode;
  redirectTo?: string;
  onBackHome: () => void;
  onGoToMe: (user: User, redirectTo?: string, isRegistration?: boolean) => void;
}) {
  const { locale } = useI18n();
  const copy = locale === 'vi' ? AUTH_COPY.vi : locale === 'zh-CN' ? AUTH_COPY.zh : AUTH_COPY.en;
  const [step, setStep] = useState<AuthStep>(() => getInitialStep(initialMode));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(() => getInitialAuthError(locale));
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<User | null>(null);
  const [verificationEmailSent, setVerificationEmailSent] = useState<boolean | null>(null);
  const mode: AuthMode = step === 'register' ? 'register' : 'login';
  const resetToken = new URLSearchParams(window.location.search).get('token') || '';

  function switchStep(nextStep: AuthStep) {
    setStep(nextStep);
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (step === 'verify') {
      if (!registeredUser) {
        switchStep('register');
        return;
      }
      setIsSubmitting(true);
      try {
        const refreshedUser = await getMe();
        if (!refreshedUser.emailVerifiedAt) {
          setError(copy.verifyPending);
          return;
        }
        onGoToMe(refreshedUser, redirectTo, true);
      } catch {
        setError(copy.serviceUnavailable);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (step === 'forgot') {
      setIsSubmitting(true);
      try {
        await forgotPassword(email);
        setSuccess(copy.forgotSuccess);
      } catch (nextError) {
        setError(locale === 'zh-CN' ? (nextError as Error).message || copy.serviceUnavailable : copy.serviceUnavailable);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!password) {
      setError(copy.missingPassword);
      return;
    }
    if ((step === 'register' || step === 'reset') && password.length < 8) {
      setError(copy.shortPassword);
      return;
    }
    if ((step === 'register' || step === 'reset') && password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }
    if (step === 'reset' && !resetToken) {
      setError(copy.missingResetToken);
      return;
    }

    setIsSubmitting(true);
    try {
      let result;
      if (step === 'login') {
        result = await login(email, password);
      } else if (step === 'register') {
        result = await register(email, password);
        setRegisteredUser(result.user);
        setVerificationEmailSent(result.verificationEmailSent !== false);
        setStep('verify');
        setPassword('');
        setConfirmPassword('');
        return;
      } else {
        await resetPassword(resetToken, password);
        setPassword('');
        setConfirmPassword('');
        setStep('login');
        setSuccess(copy.resetSuccess);
        return;
      }
      onGoToMe(result.user, redirectTo, step === 'register');
    } catch (nextError) {
      setError(locale === 'zh-CN' ? (nextError as Error).message || copy.serviceUnavailable : copy.serviceUnavailable);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerification() {
    setError(null);
    setSuccess(null);
    setIsResending(true);
    try {
      const result = await resendEmailVerification();
      if (result.alreadyVerified && registeredUser) {
        const refreshedUser = await getMe();
        onGoToMe(refreshedUser, redirectTo, true);
        return;
      }
      setVerificationEmailSent(true);
      setSuccess(copy.verifyResent);
    } catch {
      setVerificationEmailSent(false);
      setError(copy.verifySendFailed);
    } finally {
      setIsResending(false);
    }
  }

  function continueUnverified() {
    if (!registeredUser) {
      switchStep('register');
      return;
    }
    onGoToMe(registeredUser, redirectTo, true);
  }

  function continueWithGoogle() {
    setError(null);
    setSuccess(null);
    startGoogleLogin(redirectTo);
  }

  return (
    <div className="page-stack brand-page brand-auth-page">
      <section className="page-hero auth-hero">
        <p className="page-kicker">{step === 'verify' ? copy.verifyKicker : copy.kicker}</p>
        <h1>{step === 'verify' ? copy.verifyTitle : step === 'forgot' ? copy.forgotTitle : step === 'reset' ? copy.resetTitle : mode === 'login' ? copy.loginTitle : copy.registerTitle}</h1>
        <p className="page-body">{step === 'verify' ? copy.verifyBody : step === 'forgot' ? copy.forgotBody : step === 'reset' ? copy.resetBody : copy.body}</p>
      </section>

      <section className="auth-layout">
        <form className={`auth-form${step === 'verify' ? ' auth-form-verification' : ''}`} onSubmit={submit}>
          {step !== 'verify' && <div className="auth-tabs" role="tablist" aria-label={copy.tabAria}>
            <button type="button" className={step === 'login' ? 'active' : ''} onClick={() => switchStep('login')}>{copy.login}</button>
            <button type="button" className={step === 'register' ? 'active' : ''} onClick={() => switchStep('register')}>{copy.register}</button>
          </div>}

          {(step === 'login' || step === 'register') && (
            <>
              <button type="button" className="google-auth-button" onClick={continueWithGoogle}>
                <span className="google-auth-icon" aria-hidden="true">G</span>
                {copy.google}
              </button>
              <div className="auth-divider">{copy.divider}</div>
            </>
          )}

          {step !== 'reset' && step !== 'verify' && (
            <label>
              <span>{copy.email}</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </label>
          )}
          {step !== 'forgot' && step !== 'verify' && (
            <label>
              <span>{copy.password}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={step === 'register' || step === 'reset' ? copy.registerPlaceholder : copy.passwordPlaceholder} autoComplete={step === 'login' ? 'current-password' : 'new-password'} required />
              {(step === 'register' || step === 'reset') && <small className="auth-field-hint">{copy.passwordHint}</small>}
            </label>
          )}
          {(step === 'register' || step === 'reset') && (
            <label>
              <span>{copy.confirmPassword}</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={copy.confirmPassword} autoComplete="new-password" required />
            </label>
          )}

          {step === 'verify' && registeredUser && (
            <div className="auth-verification-step" role="status">
              <div className="auth-verification-icon" aria-hidden="true">✉</div>
              <div>
                <small>{copy.email}</small>
                <strong>{registeredUser.email}</strong>
                <p>{verificationEmailSent ? copy.verifySent : copy.verifyNotSent}</p>
              </div>
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <InlineActions>
            {step === 'verify' ? (
              <>
                <button type="submit" disabled={isSubmitting || isResending}>{isSubmitting ? copy.verifyChecking : copy.verifyCheck}</button>
                <GhostButton onClick={continueUnverified}>{copy.verifyContinue}</GhostButton>
                <GhostButton onClick={() => void resendVerification()} disabled={isResending || isSubmitting}>{isResending ? copy.verifyResending : copy.verifyResend}</GhostButton>
              </>
            ) : <>
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? copy.submitting : step === 'forgot' ? copy.forgotSubmit : step === 'reset' ? copy.resetSubmit : mode === 'login' ? copy.login : copy.registerSubmit}
              </button>
            {step === 'login' ? (
              <GhostButton onClick={() => switchStep('forgot')}>{copy.forgotPassword}</GhostButton>
            ) : step === 'forgot' || step === 'reset' ? (
              <GhostButton onClick={() => switchStep('login')}>{copy.backToLogin}</GhostButton>
            ) : (
              <GhostButton onClick={onBackHome}>{copy.backHome}</GhostButton>
            )}
            </>}
          </InlineActions>
        </form>

        <div className="auth-aside">
          <div className="auth-aside-copy">
            <p className="page-kicker">{copy.asideKicker}</p>
            <h2>{copy.asideTitle}</h2>
            <p>{copy.asideBody}</p>
          </div>
          <div className="auth-progress-lab" aria-hidden="true">
            {copy.asideItems.map((item, index) => (
              <span key={item} style={{ '--auth-row': index } as CSSProperties}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                {item}
              </span>
            ))}
            <em>{copy.asideFootnote}</em>
          </div>
        </div>
      </section>
    </div>
  );
}

