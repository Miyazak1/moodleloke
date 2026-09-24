import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import {
  EMPTY_STUDENT_PROFILE_DRAFT,
  StudentProfileFields,
  studentProfileDraftPayload,
  studentProfileToDraft,
  type StudentProfileDraft
} from '../components/StudentProfileFields';
import { UserAvatar } from '../components/UserAvatar';
import { useI18n } from '../i18n/useI18n';
import type { User } from '../lib/api';
import { getMyStudentProfile, updateMyStudentProfile } from '../lib/api-me';
import { updateMeProfile } from '../lib/auth';
import { buildAuthRedirectUrl, safeReturnPath } from '../lib/app-navigation';
import { routes } from '../lib/routes';
import '../styles/onboarding.css';
import '../styles/content-typography.css';

const COPY = {
  'zh-CN': {
    kicker: '注册引导', title: '先了解你，再安排合适的 CSCA 路径。', body: '只需要两步。这里不收集证件、详细生日或家庭地址，所有信息之后都能修改。',
    stepOne: '学习阶段', stepTwo: 'CSCA 计划', stepDone: '设置完成', basicTitle: '你现在处于哪个学习阶段？', basicBody: '这些信息帮助系统用适合你当前阶段的方式组织练习。',
    planTitle: '你准备怎样参加 CSCA？', planBody: '选择备考科目和语言后，我们会优先展示相关练习。', displayName: '昵称', displayHint: '用于学习主页和账号菜单',
    next: '继续设置学习计划', back: '上一步', finish: '保存学习档案', skip: '稍后再设置', saving: '保存中…', load: '正在读取学习档案…', login: '请先登录后继续注册引导。', loginCta: '去登录',
    requiredBasic: '请选择教育阶段。', requiredPlan: '请至少选择一个备考科目，并选择题目与解析语言。', nameError: '昵称需要 1–40 个字符。', saveError: '学习档案暂时无法保存，请稍后重试。',
    doneTitle: '学习档案设置好了', doneBody: '我们会优先展示与你的阶段、科目和语言匹配的练习。', continue: '开始学习', mock: '先做一次模考', edit: '修改资料', privacy: '这些信息仅用于账号内的学习路径与统计。',
    optionalTitle: '补充更多信息', optionalBody: '性别、所在地区和毕业年份都是可选项', progress: '已完成 {percent}%', subjectCount: '已选择 {count} 个备考科目', languageReady: '练习语言已设置'
  },
  en: {
    kicker: 'Account setup', title: 'Tell us where you are, then get a clearer CSCA path.', body: 'Two short steps. We do not collect identity documents, exact birth dates, or home addresses here, and every answer can be changed later.',
    stepOne: 'Study stage', stepTwo: 'CSCA plan', stepDone: 'Ready', basicTitle: 'Where are you in your studies?', basicBody: 'This helps organize practice at the right stage for you.',
    planTitle: 'How are you preparing for CSCA?', planBody: 'Your subjects and language determine which practice appears first.', displayName: 'Display name', displayHint: 'Shown in your learning dashboard and account menu',
    next: 'Continue to study plan', back: 'Back', finish: 'Save study profile', skip: 'Set up later', saving: 'Saving…', load: 'Loading your study profile…', login: 'Log in to continue account setup.', loginCta: 'Log in',
    requiredBasic: 'Select your education stage.', requiredPlan: 'Select at least one subject and a question language.', nameError: 'Display name must be 1–40 characters.', saveError: 'Your study profile could not be saved. Try again shortly.',
    doneTitle: 'Your study profile is ready', doneBody: 'Practice matching your stage, subjects, and language will appear first.', continue: 'Start learning', mock: 'Take a mock exam', edit: 'Edit details', privacy: 'These details are used only for your account learning path and statistics.',
    optionalTitle: 'Add more details', optionalBody: 'Gender, location, and graduation year are optional', progress: '{percent}% complete', subjectCount: '{count} CSCA subjects selected', languageReady: 'Practice language is set'
  },
  vi: {
    kicker: 'Thiết lập tài khoản', title: 'Cho chúng tôi biết giai đoạn của bạn để tạo lộ trình CSCA rõ ràng hơn.', body: 'Chỉ hai bước ngắn. Không thu thập giấy tờ, ngày sinh chính xác hay địa chỉ nhà và bạn có thể sửa lại sau.',
    stepOne: 'Giai đoạn học', stepTwo: 'Kế hoạch CSCA', stepDone: 'Hoàn tất', basicTitle: 'Bạn đang ở giai đoạn học nào?', basicBody: 'Thông tin này giúp sắp xếp bài luyện phù hợp.',
    planTitle: 'Bạn đang chuẩn bị CSCA như thế nào?', planBody: 'Môn học và ngôn ngữ sẽ quyết định nội dung được ưu tiên.', displayName: 'Tên hiển thị', displayHint: 'Hiển thị trong trang học tập và menu tài khoản',
    next: 'Tiếp tục kế hoạch học', back: 'Quay lại', finish: 'Lưu hồ sơ học tập', skip: 'Thiết lập sau', saving: 'Đang lưu…', load: 'Đang tải hồ sơ học tập…', login: 'Hãy đăng nhập để tiếp tục thiết lập.', loginCta: 'Đăng nhập',
    requiredBasic: 'Hãy chọn giai đoạn học tập.', requiredPlan: 'Chọn ít nhất một môn và ngôn ngữ câu hỏi.', nameError: 'Tên hiển thị phải có 1–40 ký tự.', saveError: 'Chưa thể lưu hồ sơ. Vui lòng thử lại sau.',
    doneTitle: 'Hồ sơ học tập đã sẵn sàng', doneBody: 'Bài luyện phù hợp với giai đoạn, môn học và ngôn ngữ sẽ được ưu tiên.', continue: 'Bắt đầu học', mock: 'Làm bài thi thử', edit: 'Chỉnh sửa', privacy: 'Thông tin chỉ dùng cho lộ trình và thống kê trong tài khoản của bạn.',
    optionalTitle: 'Bổ sung thông tin', optionalBody: 'Giới tính, khu vực và năm tốt nghiệp đều không bắt buộc', progress: 'Đã hoàn thành {percent}%', subjectCount: 'Đã chọn {count} môn CSCA', languageReady: 'Đã đặt ngôn ngữ luyện tập'
  }
} as const;

export function StudentOnboardingPage({ currentUser, isResolvingAuth, returnTo, onCurrentUserChange, onNavigate }: {
  currentUser: User | null;
  isResolvingAuth: boolean;
  returnTo?: string;
  onCurrentUserChange: (user: User | null) => void;
  onNavigate: (path: string) => void;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [draft, setDraft] = useState<StudentProfileDraft>(EMPTY_STUDENT_PROFILE_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLFormElement | null>(null);
  const previousStepRef = useRef(step);
  const nextPath = safeReturnPath(returnTo, routes.me);
  const progressPercent = step === 1 ? 50 : 100;

  useEffect(() => setDisplayName(currentUser?.displayName ?? ''), [currentUser?.displayName]);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  useEffect(() => {
    if (isResolvingAuth) return;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    if (currentUser.role === 'admin') {
      window.location.assign('/authoring.html');
      return;
    }
    let active = true;
    setIsLoading(true);
    void getMyStudentProfile()
      .then((profile) => {
        if (!active) return;
        setDraft(studentProfileToDraft(profile));
        if (profile.onboardingCompletedAt) setStep(3);
      })
      .catch(() => active && setError(copy.saveError))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [copy.saveError, currentUser?.id, currentUser?.role, isResolvingAuth]);

  function goNext() {
    setError(null);
    const name = displayName.trim();
    if (!name || name.length > 40) return setError(copy.nameError);
    if (!draft.educationStageCode) return setError(copy.requiredBasic);
    setStep(2);
  }

  async function finish() {
    if (!draft.targetSubjectCodes.length || !draft.preferredQuestionLanguageCode) {
      setError(copy.requiredPlan);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      if (displayName.trim() !== currentUser?.displayName) {
        const nextUser = await updateMeProfile({ displayName: displayName.trim() });
        onCurrentUserChange(nextUser);
      }
      await updateMyStudentProfile({ ...studentProfileDraftPayload(draft), onboardingAction: 'complete' });
      setStep(3);
    } catch (nextError) {
      setError((nextError as Error).message || copy.saveError);
    } finally {
      setIsSaving(false);
    }
  }

  async function skip() {
    setError(null);
    setIsSaving(true);
    try {
      await updateMyStudentProfile({ onboardingAction: 'skip' });
      onNavigate(nextPath);
    } catch (nextError) {
      setError((nextError as Error).message || copy.saveError);
      setIsSaving(false);
    }
  }

  function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) goNext();
    if (step === 2) void finish();
  }

  if (isResolvingAuth || isLoading) return <div className="onboarding-page brand-page"><section className="onboarding-loading" aria-busy="true">{copy.load}</section></div>;
  if (!currentUser) {
    const onboardingReturn = `${routes.onboarding}?returnTo=${encodeURIComponent(nextPath)}`;
    return <div className="onboarding-page brand-page"><section className="onboarding-auth-gate"><h1>{copy.login}</h1><button type="button" onClick={() => onNavigate(buildAuthRedirectUrl(onboardingReturn))}>{copy.loginCta}</button></section></div>;
  }

  return (
    <div className="onboarding-page brand-page">
      <aside className="onboarding-intro">
        <UserAvatar user={currentUser} size="lg" />
        <p className="page-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <ol aria-label={copy.kicker}>
          <li className={step === 1 ? 'active' : step > 1 ? 'complete' : ''}><b>1</b><span>{copy.stepOne}</span></li>
          <li className={step === 2 ? 'active' : step > 2 ? 'complete' : ''}><b>2</b><span>{copy.stepTwo}</span></li>
          <li className={step === 3 ? 'active' : ''}><b><Icon name="lucide:check" color="currentColor" /></b><span>{copy.stepDone}</span></li>
        </ol>
        <small><Icon name="lucide:shield-check" color="currentColor" />{copy.privacy}</small>
      </aside>

      <form ref={workspaceRef} className="onboarding-workspace" onSubmit={submitStep}>
        {step < 3 && <div className="onboarding-progress" aria-label={copy.progress.replace('{percent}', String(progressPercent))}>
          <span><b>{copy.progress.replace('{percent}', String(progressPercent))}</b><i>{step}/2</i></span>
          <div><span style={{ width: `${progressPercent}%` }} /></div>
        </div>}
        {step === 1 && <>
          <header><span>01</span><div><h2>{copy.basicTitle}</h2><p>{copy.basicBody}</p></div></header>
          <div className="onboarding-name-field"><label><span>{copy.displayName}<small className="field-requirement required">*</small></span><input value={displayName} maxLength={40} autoComplete="nickname" onChange={(event) => setDisplayName(event.target.value)} /></label><small>{copy.displayHint}</small></div>
          <StudentProfileFields draft={draft} onChange={setDraft} section="basic-core" showRequirementLabels />
          <details className="onboarding-optional-fields">
            <summary><span><Icon name="lucide:plus" color="currentColor" /></span><div><strong>{copy.optionalTitle}</strong><small>{copy.optionalBody}</small></div><Icon name="lucide:chevron-down" color="currentColor" /></summary>
            <StudentProfileFields draft={draft} onChange={setDraft} section="basic-optional" />
          </details>
        </>}
        {step === 2 && <>
          <header><span>02</span><div><h2>{copy.planTitle}</h2><p>{copy.planBody}</p></div></header>
          <StudentProfileFields draft={draft} onChange={setDraft} section="plan" showRequirementLabels />
        </>}
        {step === 3 && <section className="onboarding-done">
          <span><Icon name="lucide:check" color="currentColor" /></span>
          <h2>{copy.doneTitle}</h2><p>{copy.doneBody}</p>
          <ul><li><Icon name="lucide:book-open-check" color="currentColor" />{copy.subjectCount.replace('{count}', String(draft.targetSubjectCodes.length))}</li><li><Icon name="lucide:languages" color="currentColor" />{copy.languageReady}</li></ul>
          <div><button type="button" onClick={() => onNavigate(nextPath)}>{copy.continue}<Icon name="lucide:arrow-right" color="currentColor" /></button></div>
          <button type="button" className="text-action" onClick={() => setStep(1)}>{copy.edit}</button>
        </section>}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        {step < 3 && <footer>
          <button type="button" className="text-action" disabled={isSaving} onClick={() => void skip()}>{copy.skip}</button>
          <div>{step === 2 && <button type="button" className="secondary" disabled={isSaving} onClick={() => setStep(1)}>{copy.back}</button>}<button type="submit" disabled={isSaving}>{isSaving ? copy.saving : step === 1 ? copy.next : copy.finish}<Icon name="lucide:arrow-right" color="currentColor" /></button></div>
        </footer>}
      </form>
    </div>
  );
}
