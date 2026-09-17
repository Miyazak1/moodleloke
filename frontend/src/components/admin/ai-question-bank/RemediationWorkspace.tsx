import {
  AdminPanel,
  AdminPanelHeader
} from '../AdminWorkbench';
import type {
  AdminAIQuestioningMisconceptions,
  AdminAIQuestioningRemediation
} from '../../../lib/api-types';
import type {
  AdminRunAction,
  ConceptCardEditDraft,
  MisconceptionEditDraft
} from './types';

export type MisconceptionGovernancePanelProps = {
  governance: AdminAIQuestioningMisconceptions['governance'];
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  onReviewMisconception: (misconceptionId: number) => Promise<unknown>;
  onCreateConceptCard: (misconceptionId: number) => Promise<unknown>;
  onCreateVariant: (misconceptionId: number) => Promise<unknown>;
};

function MisconceptionGovernancePanel({
  governance,
  isActionBusy,
  runAction,
  onReviewMisconception,
  onCreateConceptCard,
  onCreateVariant
}: MisconceptionGovernancePanelProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker="错因治理" title={`${governance.summary.totalActionable} 个动作`} />
      <div className="metric-grid three">
        <div><span>疑似重复</span><strong>{governance.summary.possibleDuplicateCount}</strong></div>
        <div><span>缺概念卡</span><strong>{governance.summary.missingConceptCardCount}</strong></div>
        <div><span>孤立标签</span><strong>{governance.summary.orphanTagCount}</strong></div>
      </div>
      <div className="admin-list compact">
        {governance.suggestions.slice(0, 8).map((item) => {
          const reviewBusy = isActionBusy(`misconception-review-${item.misconceptionId}`);
          const cardBusy = isActionBusy(`misconception-card-${item.misconceptionId}`);
          const variantBusy = isActionBusy(`misconception-variant-${item.misconceptionId}`);
          return (
            <div key={`${item.issue}-${item.misconceptionId}-${item.targetId ?? 'none'}`}>
              <strong>{item.label}</strong>
              <span>{item.issue} · {item.subject} · {item.topicTitle || '-'} · {item.reason}</span>
              <div className="admin-inline-actions">
                <button type="button" className={reviewBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`misconception-review-${item.misconceptionId}`, `标记错因复核 #${item.misconceptionId}`, () => onReviewMisconception(item.misconceptionId))} disabled={reviewBusy}>
                  {reviewBusy ? '标记中' : '标记复核'}
                </button>
                <button type="button" className={cardBusy ? 'admin-action-loading' : undefined} onClick={() => void runAction(`misconception-card-${item.misconceptionId}`, `创建概念卡 #${item.misconceptionId}`, () => onCreateConceptCard(item.misconceptionId))} disabled={cardBusy}>
                  {cardBusy ? '创建中' : '创建概念卡'}
                </button>
                <button type="button" className={variantBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`misconception-variant-${item.misconceptionId}`, `生成变式 #${item.misconceptionId}`, () => onCreateVariant(item.misconceptionId))} disabled={variantBusy}>
                  {variantBusy ? '生成中' : '生成变式'}
                </button>
              </div>
            </div>
          );
        })}
        {governance.suggestions.length === 0 && <p className="form-hint">当前没有错因治理建议。</p>}
      </div>
    </AdminPanel>
  );
}

export type MisconceptionDictionaryPanelProps = {
  items: AdminAIQuestioningMisconceptions['items'];
  drafts: Record<number, MisconceptionEditDraft>;
  mergeTargets: Record<number, string>;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  onEnsureDraft: (item: AdminAIQuestioningMisconceptions['items'][number]) => void;
  onUpdateDraft: (misconceptionId: number, patch: Partial<MisconceptionEditDraft>) => void;
  onCancelDraft: (misconceptionId: number) => void;
  onSave: (item: AdminAIQuestioningMisconceptions['items'][number]) => Promise<void>;
  onReview: (misconceptionId: number) => Promise<unknown>;
  onArchive: (misconceptionId: number) => Promise<unknown>;
  onRestore: (misconceptionId: number) => Promise<unknown>;
  onMergeTargetChange: (misconceptionId: number, value: string) => void;
  onMerge: (item: AdminAIQuestioningMisconceptions['items'][number]) => Promise<void>;
};

function MisconceptionDictionaryPanel({
  items,
  drafts,
  mergeTargets,
  isActionBusy,
  runAction,
  onEnsureDraft,
  onUpdateDraft,
  onCancelDraft,
  onSave,
  onReview,
  onArchive,
  onRestore,
  onMergeTargetChange,
  onMerge
}: MisconceptionDictionaryPanelProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker="错因字典" title={`${items.length} 条`} />
      <div className="admin-list compact">
        {items.slice(0, 10).map((item) => {
          const draft = drafts[item.id];
          const saveBusy = isActionBusy(`misconception-save-${item.id}`);
          const reviewBusy = isActionBusy(`misconception-review-item-${item.id}`);
          const archiveBusy = isActionBusy(`misconception-archive-${item.id}`);
          const restoreBusy = isActionBusy(`misconception-restore-${item.id}`);
          const mergeBusy = isActionBusy(`misconception-merge-${item.id}`);
          return (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <span>{item.subject} · {item.topicTitle || '-'} · {item.status} · 题目 {item.questionCount} · 选项 {item.optionCount}</span>
              {draft ? (
                <div className="admin-inline-editor">
                  <div className="admin-form-grid">
                    <label className="admin-form-field">
                      名称
                      <input value={draft.label} onChange={(event) => onUpdateDraft(item.id, { label: event.target.value })} />
                    </label>
                    <label className="admin-form-field full">
                      描述
                      <textarea value={draft.description} onChange={(event) => onUpdateDraft(item.id, { description: event.target.value })} />
                    </label>
                  </div>
                  <div className="admin-inline-actions">
                    <button type="button" className="ghost-button" onClick={() => onCancelDraft(item.id)} disabled={saveBusy}>
                      取消
                    </button>
                    <button type="button" className={saveBusy ? 'admin-action-loading' : undefined} onClick={() => void onSave(item)} disabled={saveBusy}>
                      {saveBusy ? '保存中' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="admin-inline-actions">
                  <button type="button" className="ghost-button" onClick={() => onEnsureDraft(item)} disabled={saveBusy}>
                    编辑
                  </button>
                  <button type="button" className={reviewBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`misconception-review-item-${item.id}`, `标记错因复核 #${item.id}`, () => onReview(item.id))} disabled={reviewBusy}>
                    {reviewBusy ? '复核中' : '复核'}
                  </button>
                  <button type="button" className={archiveBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`misconception-archive-${item.id}`, `归档错因 #${item.id}`, () => onArchive(item.id))} disabled={archiveBusy || item.status === 'archived'}>
                    {archiveBusy ? '归档中' : '归档'}
                  </button>
                  <button type="button" className={restoreBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`misconception-restore-${item.id}`, `恢复错因 #${item.id}`, () => onRestore(item.id))} disabled={restoreBusy || item.status !== 'archived'}>
                    {restoreBusy ? '恢复中' : '恢复'}
                  </button>
                </div>
              )}
              <div className="admin-inline-form">
                <label>
                  合并到 ID
                  <input value={mergeTargets[item.id] ?? ''} onChange={(event) => onMergeTargetChange(item.id, event.target.value)} />
                </label>
                <button type="button" className={mergeBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void onMerge(item)} disabled={mergeBusy || !(mergeTargets[item.id] ?? '').trim()}>
                  {mergeBusy ? '合并中' : '合并'}
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="form-hint">当前没有错因字典项。</p>}
      </div>
    </AdminPanel>
  );
}

export type RemediationMaterialsPanelProps = {
  remediation: AdminAIQuestioningRemediation;
  conceptCardDrafts: Record<number, ConceptCardEditDraft>;
  isActionBusy: (actionId: string) => boolean;
  runAction: AdminRunAction;
  canManageConceptCard: (item: AdminAIQuestioningRemediation['items'][number]) => boolean;
  onEnsureConceptCardDraft: (item: AdminAIQuestioningRemediation['items'][number]) => void;
  onUpdateConceptCardDraft: (itemId: number, patch: Partial<ConceptCardEditDraft>) => void;
  onCancelConceptCardDraft: (itemId: number) => void;
  onSaveConceptCard: (item: AdminAIQuestioningRemediation['items'][number]) => Promise<void>;
  onPublishConceptCard: (itemId: number) => Promise<unknown>;
  onArchiveConceptCard: (itemId: number) => Promise<unknown>;
};

function RemediationMaterialsPanel({
  remediation,
  conceptCardDrafts,
  isActionBusy,
  runAction,
  canManageConceptCard,
  onEnsureConceptCardDraft,
  onUpdateConceptCardDraft,
  onCancelConceptCardDraft,
  onSaveConceptCard,
  onPublishConceptCard,
  onArchiveConceptCard
}: RemediationMaterialsPanelProps) {
  return (
    <AdminPanel>
      <AdminPanelHeader kicker="补救材料" title={`${remediation.items.length} 条`} />
      <div className="metric-grid four">
        <div><span>概念卡草稿</span><strong>{remediation.summary.conceptCardDrafts}</strong></div>
        <div><span>变式蓝图</span><strong>{remediation.summary.variantBlueprints}</strong></div>
        <div><span>变式候选</span><strong>{remediation.summary.variantCandidates}</strong></div>
        <div><span>待审变式</span><strong>{remediation.summary.pendingVariantCandidates}</strong></div>
      </div>
      <div className="admin-list compact">
        {remediation.items.slice(0, 8).map((item) => {
          const saveBusy = isActionBusy(`concept-card-save-${item.id}`);
          const publishBusy = isActionBusy(`concept-card-publish-${item.id}`);
          const archiveBusy = isActionBusy(`concept-card-archive-${item.id}`);
          return (
            <div key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.kind} · {item.subject} · topic #{item.topicId} · {item.status} · {item.misconceptionLabel || '-'}</span>
              {canManageConceptCard(item) && (
                conceptCardDrafts[item.id] ? (
                  <div className="admin-inline-editor">
                    <div className="admin-form-grid">
                      <label className="admin-form-field">
                        标题
                        <input value={conceptCardDrafts[item.id].title} onChange={(event) => onUpdateConceptCardDraft(item.id, { title: event.target.value })} />
                      </label>
                      <label className="admin-form-field full">
                        内容
                        <textarea value={conceptCardDrafts[item.id].body} onChange={(event) => onUpdateConceptCardDraft(item.id, { body: event.target.value })} />
                      </label>
                      <label className="admin-form-field full">
                        备注
                        <input value={conceptCardDrafts[item.id].note} onChange={(event) => onUpdateConceptCardDraft(item.id, { note: event.target.value })} />
                      </label>
                    </div>
                    <div className="admin-inline-actions">
                      <button type="button" className="ghost-button" onClick={() => onCancelConceptCardDraft(item.id)} disabled={saveBusy}>
                        取消
                      </button>
                      <button type="button" className={saveBusy ? 'admin-action-loading' : undefined} onClick={() => void onSaveConceptCard(item)} disabled={saveBusy}>
                        {saveBusy ? '保存中' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-inline-actions">
                    <button type="button" className="ghost-button" onClick={() => onEnsureConceptCardDraft(item)} disabled={saveBusy}>
                      编辑
                    </button>
                    <button type="button" className={publishBusy ? 'admin-action-loading' : undefined} onClick={() => void runAction(`concept-card-publish-${item.id}`, `发布概念卡 #${item.id}`, () => onPublishConceptCard(item.id))} disabled={publishBusy || item.status === 'published'}>
                      {publishBusy ? '发布中' : '发布'}
                    </button>
                    <button type="button" className={archiveBusy ? 'ghost-button admin-action-loading' : 'ghost-button'} onClick={() => void runAction(`concept-card-archive-${item.id}`, `归档概念卡 #${item.id}`, () => onArchiveConceptCard(item.id))} disabled={archiveBusy || item.status === 'archived'}>
                      {archiveBusy ? '归档中' : '归档'}
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
        {remediation.items.length === 0 && <p className="form-hint">当前没有补救材料。</p>}
      </div>
    </AdminPanel>
  );
}

export type RemediationWorkspaceProps =
  MisconceptionGovernancePanelProps &
  MisconceptionDictionaryPanelProps &
  RemediationMaterialsPanelProps;

export function RemediationWorkspace({
  governance,
  isActionBusy,
  runAction,
  onReviewMisconception,
  onCreateConceptCard,
  onCreateVariant,
  items,
  drafts,
  mergeTargets,
  onEnsureDraft,
  onUpdateDraft,
  onCancelDraft,
  onSave,
  onReview,
  onArchive,
  onRestore,
  onMergeTargetChange,
  onMerge,
  remediation,
  conceptCardDrafts,
  canManageConceptCard,
  onEnsureConceptCardDraft,
  onUpdateConceptCardDraft,
  onCancelConceptCardDraft,
  onSaveConceptCard,
  onPublishConceptCard,
  onArchiveConceptCard
}: RemediationWorkspaceProps) {
  return (
    <section className="admin-work-grid two">
      <MisconceptionGovernancePanel
        governance={governance}
        isActionBusy={isActionBusy}
        runAction={runAction}
        onReviewMisconception={onReviewMisconception}
        onCreateConceptCard={onCreateConceptCard}
        onCreateVariant={onCreateVariant}
      />

      <MisconceptionDictionaryPanel
        items={items}
        drafts={drafts}
        mergeTargets={mergeTargets}
        isActionBusy={isActionBusy}
        runAction={runAction}
        onEnsureDraft={onEnsureDraft}
        onUpdateDraft={onUpdateDraft}
        onCancelDraft={onCancelDraft}
        onSave={onSave}
        onReview={onReview}
        onArchive={onArchive}
        onRestore={onRestore}
        onMergeTargetChange={onMergeTargetChange}
        onMerge={onMerge}
      />

      <RemediationMaterialsPanel
        remediation={remediation}
        conceptCardDrafts={conceptCardDrafts}
        isActionBusy={isActionBusy}
        runAction={runAction}
        canManageConceptCard={canManageConceptCard}
        onEnsureConceptCardDraft={onEnsureConceptCardDraft}
        onUpdateConceptCardDraft={onUpdateConceptCardDraft}
        onCancelConceptCardDraft={onCancelConceptCardDraft}
        onSaveConceptCard={onSaveConceptCard}
        onPublishConceptCard={onPublishConceptCard}
        onArchiveConceptCard={onArchiveConceptCard}
      />
    </section>
  );
}
