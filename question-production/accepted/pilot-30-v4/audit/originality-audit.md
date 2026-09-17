# Pilot-30 V4 原创性与正式题库碰撞审计

- 时间：2026-09-15T11:34:55.538Z
- 报告修订：2（final_selection_with_repair2_topic_mapping_replacement）
- 当前生产批次：pilot-30-v4、pilot-30-v4-repair、pilot-30-v4-repair2
- Provider：未调用
- 数据库：connected_read_only
- 远程官方源未访问，仅作为覆盖限制，不自动降级题目状态。

## 总体统计

| 科目 | clear | ambiguous | blocked |
|---|---:|---:|---:|
| math | 10 | 0 | 0 |
| physics | 10 | 0 | 0 |
| chemistry | 10 | 0 | 0 |

## 碰撞类型拆分

- 精确重复：0 题（无）
- 达阈值文本近似：0 题（无）
- 结构同构且近似达到风险阈值：0 题（无）
- 仅 family 重复：0 题；family 重复本身不改变状态。

## 题包内部 family 重复

- 无。
- 唯一性验证：数学 10/10、物理 10/10、化学 10/10；结果 通过。

family/知识点相同本身不构成 blocked；判定还要求实际文本、数值遮蔽骨架或 canonical task 证据。

## 所有非 clear 题

- 无。

## 覆盖与限制

- 本地 source corpus：524 题/12 文件。
- 数据库 active source questions：425；csca_questions：323；special_practice_questions：960。
- V1-V3 独立候选：120 题；已排除 V4 整批及同 candidateId 镜像。
- metadataOverride 未参与题面相似度，仅在逐题元数据中留痕。
- 未访问远程/不可用官方题集；未把它描述为已检查，也未因此把无命中题自动标 ambiguous。
- 确定性 n-gram/骨架阈值与仓库 shadow novelty policy 不能替代最终人工版权判断。
- 本报告只读且不授权发布或入库。

## 修订历史

- 2026-09-15T10:54:31.075Z：selection=b78012e97a6bb4a38fabbcbfcc595a5151022f43e86d625ccb02e52d5fa0eab3，summary={"clear":26,"ambiguous":0,"blocked":4}，report=5cd48fe7a0ccc599fb4053f370c28525597f85b22655745c2f08ba3802ddf1c4
- 2026-09-15T11:00:48.969Z：selection=c303c5bacd681aeb0468b8de05ec883529453527ed30cb6be258c22130fb443d，summary={"clear":30,"ambiguous":0,"blocked":0}，report=8cdb39b0407c50713eb6b03f430f63f1f5e5928d24a1c4e89cb80ba2da40cd4c

方法版本：pilot-30-v4-originality-audit-deterministic-v1；仓库 novelty policy：subject-practice-candidate-output-novelty-shadow-policy-low-information-scalar-aware-v8。

