import type { StudentQuestionFigure } from '../lib/api-types';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useI18n } from '../i18n/useI18n';
import './QuestionFigure.css';

export function QuestionFigure({ figure }: { figure?: StudentQuestionFigure | null }) {
  const [zoom, setZoom] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { locale } = useI18n();
  const en = locale.startsWith('en');
  useEffect(() => {
    if (!zoom) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [zoom]);
  useEffect(() => { setZoom(false); }, [figure?.data]);
  if (!figure || figure.schemaVersion !== 'student-question-figure-v1' || !['image/svg+xml', 'image/png', 'image/jpeg'].includes(figure.mime)) return null;
  return <figure className="student-question-figure" data-testid="question-figure" data-phase={figure.phase}>
    <img src={`data:${figure.mime};base64,${figure.data}`} alt={figure.alt} draggable={false} />
    <figcaption><span>{figure.caption}</span><button ref={trigger} className="student-question-figure-action" type="button" onClick={() => setZoom(true)}><Icon name="lucide:zoom-in" color="currentColor" />{en ? 'Enlarge figure' : '放大图形'}</button></figcaption>
    {zoom && createPortal(<div className="student-question-figure-zoom" role="dialog" aria-modal="true" aria-label={en ? 'Question figure' : '题目图形'} onKeyDown={event => { if (event.key === 'Escape') setZoom(false); if (event.key === 'Tab') event.preventDefault(); }}>
      <button className="student-question-figure-action" type="button" autoFocus onClick={() => setZoom(false)}><Icon name="lucide:x" color="currentColor" />{en ? 'Close' : '关闭'}</button>
      <img src={`data:${figure.mime};base64,${figure.data}`} alt={figure.alt} />
      <p>{figure.caption}</p>
    </div>, document.body)}
  </figure>;
}
