import type { Ref, RefObject } from 'react';

export type SourceImportMessage = {
  tone: 'success' | 'warning' | 'error';
  title: string;
  details: string[];
};

type SourceImportPanelProps = {
  subject: string;
  sourceImportJson: string;
  sourceImportMessage: SourceImportMessage | null;
  sourceImportFileInputRef: RefObject<HTMLInputElement | null>;
  isImportBusy: boolean;
  onChangeJson: (value: string) => void;
  onLoadFile: (file: File) => void;
  onChooseFile: () => void;
  onFillTemplate: () => void;
  onValidateJson: () => void;
  onImportJson: () => void;
  onClear: () => void;
};

export function SourceImportPanel({
  subject,
  sourceImportJson,
  sourceImportMessage,
  sourceImportFileInputRef,
  isImportBusy,
  onChangeJson,
  onLoadFile,
  onChooseFile,
  onFillTemplate,
  onValidateJson,
  onImportJson,
  onClear
}: SourceImportPanelProps) {
  return (
    <>
      <label className="admin-form-field full">
        真题 JSON
        <textarea
          value={sourceImportJson}
          onChange={(event) => onChangeJson(event.target.value)}
          placeholder={`{"document":{"subject":"${subject || 'math'}","title":"CSCA 真题样本","sourceType":"past_paper"},"questions":[{"questionNumber":"1","promptText":"...","correctAnswer":"A"}]}`}
        />
      </label>
      <div className="admin-filter-actions admin-source-import-actions">
        <input
          ref={sourceImportFileInputRef as Ref<HTMLInputElement>}
          type="file"
          accept=".json,application/json"
          className="admin-hidden-file-input"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) onLoadFile(file);
          }}
          disabled={isImportBusy}
        />
        <button type="button" className="ghost-button" onClick={onChooseFile} disabled={isImportBusy}>
          选择并自动导入 JSON
        </button>
        <button type="button" className="ghost-button" onClick={onFillTemplate} disabled={isImportBusy}>
          填入模板
        </button>
        <button type="button" className="ghost-button" onClick={onValidateJson} disabled={!sourceImportJson.trim() || isImportBusy}>
          仅检查 JSON
        </button>
        <button type="button" onClick={onImportJson} disabled={!sourceImportJson.trim() || isImportBusy}>
          {isImportBusy ? '导入并启动中' : '导入并自动画像'}
        </button>
        <button type="button" className="ghost-button" onClick={onClear} disabled={!sourceImportJson.trim() && !sourceImportMessage}>
          清空
        </button>
      </div>
      {sourceImportMessage && (
        <div className={`admin-inline-status ${sourceImportMessage.tone}`}>
          <strong>{sourceImportMessage.title}</strong>
          {sourceImportMessage.details.length > 0 && (
            <ul>
              {sourceImportMessage.details.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
