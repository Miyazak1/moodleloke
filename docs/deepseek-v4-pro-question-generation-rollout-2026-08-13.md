# DeepSeek V4 Pro Question Generation Rollout

Date: 2026-08-13

## Decision

Switch the question generator to `deepseek-v4-pro` first. Keep question review, topic mapping, and other background tasks on `deepseek-v4-flash` during the first observation window.

This is a controlled model comparison, not a replacement for deterministic validation, difficulty gates, diversity policy, queue recovery, or publication governance.

There is no human-review stage in the production publication path. Any manual inspection mentioned below is a bounded rollout evaluation only, not a runtime dependency or approval gate.

## Runtime Boundary

- Generation model: `CSCA_AI_QUESTION_GENERATION_MODEL=deepseek-v4-pro`
- Pro escalation model: `CSCA_AI_QUESTION_GENERATION_PRO_MODEL=deepseek-v4-pro`
- Review model: keep `CSCA_AI_QUESTION_REVIEW_MODEL=deepseek-v4-flash`
- Background default: keep `DEEPSEEK_BACKGROUND_DEFAULT_MODEL=deepseek-v4-flash`
- API base URL remains `https://api.deepseek.com`
- V4 Pro generation timeout: 180 seconds
- V4 Pro maximum output budget: 16,000 tokens
- Thinking mode remains at the provider default for the first comparison

The currently running backend keeps its startup environment until it is restarted. Changing `.env` alone does not migrate in-flight jobs.

## Why Generator First

The generator is the component that benefits most directly from stronger mathematics, STEM reasoning, instruction following, and longer deliberation. Holding the reviewer on Flash keeps the acceptance boundary stable, so changes in pass rate can be attributed primarily to the generator.

Switching generator and reviewer together would confound the result: a higher pass rate could mean better questions, a more permissive reviewer, or both.

## Observation Sequence

1. Finish or pause the current production observation without restarting its backend.
2. Restart one controlled observation backend with the new environment.
3. Run a small fixed sample against cells that previously had difficulty, correctness, schema, or family-policy failures.
4. Start with mathematics, then chemistry hard cells, then physics.
5. Do not expand production volume until delivery, quality, latency, and cost evidence are all recorded.

## Acceptance Metrics

- Provider delivery success rate
- Valid final JSON rate
- Deterministic validator pass rate
- Reviewer and gate pass rate
- Bounded offline acceptance sampling for correctness, unique answer, and explanation consistency
- Designed difficulty versus measured difficulty
- Task-family and diversity-policy adherence
- Median and tail latency
- Prompt, reasoning/output token usage, and estimated cost per approved question

Compare these metrics with a recent Flash baseline on equivalent subject/topic/difficulty cells. Do not use overall pass rate alone because cell mix changes the denominator.

## Stop and Roll Back

Roll back generation to `deepseek-v4-flash` when any of these persist beyond a small retry window:

- More empty or truncated final outputs
- Materially worse schema validity
- No quality or approval-rate improvement at meaningfully higher latency or cost
- Difficulty or diversity regressions
- New queue blocking caused by longer request duration

Rollback is one configuration change plus a controlled backend restart:

```env
CSCA_AI_QUESTION_GENERATION_MODEL="deepseek-v4-flash"
```

## Cost Accounting

The gateway recognizes V4 Flash and V4 Pro separately. Current defaults use the official cache-miss rates as a conservative estimate because the local usage record does not yet split cache-hit and cache-miss input tokens.

This rollout does not authorize an unbounded production run or a paid provider call by itself. A bounded live observation should be started deliberately after the backend restart boundary is clear.
