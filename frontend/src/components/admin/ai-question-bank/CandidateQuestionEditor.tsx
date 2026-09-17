import type { AdminAIQuestioningQuestion } from '../../../lib/api-types';
import type { QuestionEditDraft } from './types';

type CandidateQuestionEditorProps = {
  question: AdminAIQuestioningQuestion;
  draft: QuestionEditDraft;
  saveActionBusy: boolean;
  onCancel: () => void;
  onSave: () => void;
  onUpdateDraft: (patch: Partial<QuestionEditDraft>) => void;
  onUpdateOption: (optionIndex: number, patch: Partial<{ id: string; text: string }>) => void;
  onUpdateOptionsJson: (optionsJson: string) => void;
};

export function CandidateQuestionEditor({
  question,
  draft,
  saveActionBusy,
  onCancel,
  onSave,
  onUpdateDraft,
  onUpdateOption,
  onUpdateOptionsJson
}: CandidateQuestionEditorProps) {
  return (
    <section className="admin-inline-editor admin-candidate-inline-editor">
      <div className="admin-work-panel-heading">
        <div>
          <p className="page-kicker">质量修题</p>
          <h2>编辑 Q{question.id}</h2>
          <p>用于补解析、修选项、补标签或错因 metadata；保存后会留下后台修题 note。</p>
        </div>
        <div className="admin-inline-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={saveActionBusy}>
            取消
          </button>
          <button type="button" onClick={onSave} disabled={saveActionBusy}>
            {saveActionBusy ? '保存中' : '保存修订'}
          </button>
        </div>
      </div>
      <div className="admin-form-grid">
        <label className="admin-form-field full">
          题干
          <textarea value={draft.prompt} onChange={(event) => onUpdateDraft({ prompt: event.target.value })} />
        </label>
        <label className="admin-form-field">
          正确答案
          <select value={draft.correctAnswer} onChange={(event) => onUpdateDraft({ correctAnswer: event.target.value })}>
            {draft.options.map((option) => (
              <option key={`${question.id}-answer-${option.id}`} value={option.id}>
                {option.id || '未命名选项'}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-form-field">
          知识标签
          <input value={draft.knowledgeTags} onChange={(event) => onUpdateDraft({ knowledgeTags: event.target.value })} placeholder="逗号或换行分隔" />
        </label>
        <label className="admin-form-field full">
          解析
          <textarea value={draft.explanation} onChange={(event) => onUpdateDraft({ explanation: event.target.value })} />
        </label>
        <div className="admin-form-field full">
          <span>选项</span>
          <div className="admin-candidate-option-editor">
            {draft.options.map((option, index) => (
              <div key={`${question.id}-option-${index}`} className="admin-candidate-option-edit-row">
                <input
                  aria-label={`选项 ${index + 1} 编号`}
                  value={option.id}
                  onChange={(event) => onUpdateOption(index, { id: event.target.value })}
                />
                <input
                  aria-label={`选项 ${option.id || index + 1} 内容`}
                  value={option.text}
                  onChange={(event) => onUpdateOption(index, { text: event.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
        <label className="admin-form-field full">
          选项 JSON（高级）
          <textarea className="admin-json-textarea" value={draft.optionsJson} onChange={(event) => onUpdateOptionsJson(event.target.value)} />
        </label>
        <label className="admin-form-field full">
          错因 metadata JSON
          <textarea value={draft.optionMetadataJson} onChange={(event) => onUpdateDraft({ optionMetadataJson: event.target.value })} />
        </label>
        <label className="admin-form-field full">
          修订备注
          <input value={draft.note} onChange={(event) => onUpdateDraft({ note: event.target.value })} />
        </label>
      </div>
    </section>
  );
}
