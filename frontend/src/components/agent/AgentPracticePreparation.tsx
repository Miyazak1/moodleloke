import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { useI18n } from '../../i18n/useI18n';

export type PracticePreparation = { kind: 'start' | 'continue'; phase: 'settling' | 'preparing'; count: number };

export function AgentPracticePreparation({ preparation }: { preparation: PracticePreparation }) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return createPortal(<section className="agent-practice-preparation" aria-label={t('agent.freePractice.preparationLabel', '练习准备状态')}>
    <div className="agent-preparation-art" aria-hidden="true">
      <span className="agent-preparation-paper back" />
      <span className="agent-preparation-paper front"><Icon name="lucide:book-open-check" /><i /><i /><i /></span>
      <span className="agent-preparation-orbit"><Icon name="lucide:loader-circle" /></span>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true">
      <strong>{preparation.kind === 'continue' ? t('agent.freePractice.prepareNextTitle', '正在准备下一批练习') : t('agent.freePractice.prepareStartTitle', '正在准备本次练习')}</strong>
      <p>{preparation.phase === 'settling' ? t('agent.freePractice.preparationSettling', '正在保存本轮学习结果…') : t('agent.freePractice.preparationPreparing', '正在匹配题目、核验答案并准备所需图示…')}</p>
    </div>
    <div className="agent-preparation-track" aria-hidden="true"><i /></div>
    <div className="agent-preparation-meta"><span>{t('agent.freePractice.preparationCount', '本批 {count} 题').replace('{count}', String(preparation.count))}</span><span role="timer" aria-live="off">{t('agent.freePractice.preparationElapsed', '已等待 {seconds} 秒').replace('{seconds}', String(elapsed))}</span></div>
    <small>{elapsed >= 20 ? t('agent.freePractice.preparationLong', '准备时间稍长，请勿重复点击；题目就绪后会自动进入。') : t('agent.freePractice.preparationWait', '题目就绪后会自动进入，无需重复点击。')}</small>
    {preparation.kind === 'continue' ? <small className="agent-preparation-saved"><Icon name="lucide:check" />{t('agent.freePractice.preparationSaved', '本轮作答和结果已保留')}</small> : null}
  </section>, document.body);
}
