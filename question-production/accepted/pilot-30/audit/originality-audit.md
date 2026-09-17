# Pilot-30 题库原创性与重复碰撞审计

- 审计时间：2026-09-15T10:22:38.277Z
- 选择计划：`question-production/accepted/pilot-30/selection-plan.json`（SHA-256: `0a8c58af838daf2cf5753f3809b6aaa5bc87ef346442a9a0e812be0a1b65d06d`）
- 结论性质：只读、非正式资格判定；不得据此直接发布
- Provider：未调用；数据库：connected_read_only

## 数量结论

| 科目 | clear | ambiguous | blocked |
|---|---:|---:|---:|
| math | 0 | 0 | 10 |
| physics | 0 | 0 | 10 |
| chemistry | 0 | 0 | 10 |

说明：远程同步源清单未访问、语料拓扑完整性未获证明，所以没有碰撞证据的题也按 `ambiguous`，不误报为 `clear`。已确认仅换数字/场景/名词的题内同构簇按 `blocked`。
`overall` 与四个证据维度分开保存：题内 30 题、官方源、数据库正式题、此前仓库候选记录不会互相混称。

### 分维度统计

| 维度 | 科目 | clear | ambiguous | blocked |
|---|---|---:|---:|---:|
| 题内 30 题 | math | 7 | 0 | 3 |
| 题内 30 题 | physics | 0 | 0 | 10 |
| 题内 30 题 | chemistry | 0 | 0 | 10 |
| 官方源（含覆盖不完整性） | math | 0 | 10 | 0 |
| 官方源（含覆盖不完整性） | physics | 0 | 10 | 0 |
| 官方源（含覆盖不完整性） | chemistry | 0 | 10 | 0 |
| 数据库现有题 | math | 8 | 2 | 0 |
| 数据库现有题 | physics | 0 | 2 | 8 |
| 数据库现有题 | chemistry | 0 | 0 | 10 |
| 此前仓库候选 | math | 0 | 0 | 10 |
| 此前仓库候选 | physics | 0 | 5 | 5 |
| 此前仓库候选 | chemistry | 0 | 0 | 10 |

## 题内模板重复

- `chemistry|ph_dilution_strong_acid_base_neutralization|strong_acid_dilution`：4 题（CQ-CHEMISTRY-2001、CQ-CHEMISTRY-2002、CQ-CHEMISTRY-2004、CQ-CHEMISTRY-2005）
- `chemistry|ph_dilution_strong_acid_base_neutralization|strong_base_dilution`：4 题（CQ-CHEMISTRY-2006、CQ-CHEMISTRY-2007、CQ-CHEMISTRY-2008、CQ-CHEMISTRY-2010）
- `physics|kinematics_basic_direct_relation|uniform_speed`：4 题（CQ-PHYSICS-2001、CQ-PHYSICS-2002、CQ-PHYSICS-2003、CQ-PHYSICS-2004）
- `math|derivative_direct_evaluation|direct_polynomial_value`：3 题（CQ-MATH-1001、CQ-MATH-1002、CQ-MATH-1003）
- `chemistry|ph_dilution_strong_acid_base_neutralization|strong_acid_base_neutralization`：2 题（CQ-CHEMISTRY-2012、CQ-CHEMISTRY-2014）
- `physics|kinematics_basic_direct_relation|acceleration_from_velocity_change`：2 题（CQ-PHYSICS-2005、CQ-PHYSICS-2006）
- `physics|kinematics_basic_direct_relation|displacement_from_initial_acceleration_time`：2 题（CQ-PHYSICS-2013、CQ-PHYSICS-2014）
- `physics|kinematics_basic_direct_relation|final_velocity_from_initial_acceleration_time`：2 题（CQ-PHYSICS-2010、CQ-PHYSICS-2012）

## 逐题结论

| 题号 | 科目 | 状态 | 主要理由 |
|---|---|---|---|
| CQ-MATH-1001 | math | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1002 | math | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1003 | math | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1006 | math | blocked | repository_candidate_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1007 | math | blocked | repository_candidate_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1008 | math | blocked | repository_candidate_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1011 | math | blocked | repository_candidate_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1012 | math | blocked | repository_candidate_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1013 | math | blocked | repository_candidate_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-MATH-1014 | math | blocked | repository_candidate_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2001 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2002 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；database_existing_question_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2003 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；database_existing_question_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2004 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2005 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2006 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2010 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2012 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；database_existing_question_policy_blocked；similarity_signal_requires_human_review；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2013 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-PHYSICS-2014 | physics | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2001 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2002 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2004 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2005 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；repository_canonical_task_exact_collision；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2006 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2007 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2008 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2010 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2012 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |
| CQ-CHEMISTRY-2014 | chemistry | blocked | intra_selection_rename_number_or_noun_template_cluster；repository_candidate_policy_blocked；database_existing_question_policy_blocked；remote_source_inventory_not_accessed；source_corpus_topology_completeness_not_proven |

## 覆盖范围

- 本地官方/预测 source JSON：12 份，524 题；按科目 {"chemistry":183,"math":205,"physics":136}。已扫描 prompt/options/answer/explanation/localizations。
- 仓库 sealed 候选：登记 120 份；排除 selection plan 涉及的整个源批次（pilot-30-v2、pilot-30-v3，共 75 份）及候选自身后，将其余 45 份作为“此前批次候选记录”扫描。该层不等同于正式题库。
- 种子/seed 文件：只读盘点 82 份，并检查选中题 prompt 的逐字出现；命中文件 0 份。
- 数据库：实际连通；在 Repeatable Read + SET TRANSACTION READ ONLY 事务内读取 425 条 active source question、315 条 csca_questions，并盘点 459 条 style profile（active 3 条）、459 条 series profile、915 条 generation profile。
- 远程/外部：未访问；未同步远程 source inventory，也未进行互联网检索。

## 限制

- 本地 source JSON 被仓库既有机制定义为 partial，不能证明覆盖全部官方真题。
- 远程同步源清单和互联网均未访问；未访问的数据没有被宣称为已检查。
- 仓库 seed 文件仅做文件清单、哈希和选中题 prompt 逐字命中检查；未把生成参数空间穷举为题库。
- 结构 template key 是保守的确定性规则，能确认同一计算关系的换数/换名词簇，但不能替代语义模型或人工专家对所有潜在同构的判断。
- novelty policy 本身是 shadow/nonqualifying；本报告也不授权发布或入库。

## 方法

复用仓库 novelty policy `subject-practice-candidate-output-novelty-shadow-policy-low-information-scalar-aware-v8`，同时计算内容哈希、prompt 哈希、canonical task 指纹和题内 template key。任何 policy blocked、逐字/内容哈希碰撞、canonical task 复刻或题内仅换参数同构簇均判 blocked；弱相似或覆盖不完整判 ambiguous。

