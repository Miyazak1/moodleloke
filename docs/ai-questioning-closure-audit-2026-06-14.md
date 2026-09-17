# AI questioning closure audit - 2026-06-14

## Purpose

This document closes the open-ended "keep improving AI adaptive questioning" workstream into an executable release boundary.

The system has grown from a feature fix into a platform loop: syllabus governance, blueprint-driven AI generation, candidate review, quality feedback, adaptive practice safety, organization AI pools, BYOK, and admin operations. If the team keeps using "continue improving" as the task definition, the work can continue indefinitely.

From this point, the release rule is:

> Do not add new AI-questioning capabilities unless they are required to make the current production loop safe, understandable, or verifiably runnable.

## Current conclusion

The AI-questioning platform is no longer "not implemented." It is now in a "release-candidate with operational hardening" state.

It should be treated as:

- suitable for admin-supervised staging use;
- suitable for controlled production rollout after the release gates below pass;
- not suitable for fully automated, unsupervised question publishing;
- not finished as a long-term product area.

The most important boundary is that generated questions remain candidates until review and approval. AI generation, AI review, and deterministic validation can reduce workload, but they are not allowed to publish learner-facing questions by themselves.

## Release scope

### In Scope For This Release

The release should include only the already-built production loop:

1. Upload or maintain syllabus scope.
2. Sync syllabus constraints into blueprints.
3. Generate AI candidates from approved blueprints.
4. Review candidate evidence, validator issues, and recommendation guidance.
5. Manually fix, reject, archive, regenerate, or approve candidates.
6. Publish approved candidates into the practice pool only through the approval gate.
7. Collect adaptive-practice performance into quality metrics.
8. Route low-quality questions through quality governance.
9. Retire or reduce exposure for governed questions so adaptive practice and AI Coach do not keep using unsafe content.
10. Leave audit evidence for production, review, quality, syllabus, and organization actions.

### Out Of Scope For This Release

These are real product ideas, but they should not block release:

- fully automated question publishing;
- complete symbolic math solving;
- complete physics unit engine;
- complete chemistry equation/reaction validator;
- institution-scale KMS/HSM key management;
- SSO or domain auto-join;
- a polished multi-page admin console;
- high-volume analytics dashboards;
- fully migrated legacy special-practice bank;
- deep LLM-generated study planning beyond guarded suggestions.

## Current Evidence

The following checks are currently the authoritative release gates for this area:

```text
npm run verify:csca-ai-questioning
npm run verify:governance
npm --prefix frontend run test:admin-audit-summaries
npm --prefix frontend run test:syllabus-imports
npm --prefix frontend run test:organization-governance
npm run csca-ai-questioning:rules
npm run csca-ai-questioning:smoke
npm run csca-adaptive:rules
```

Recent local checks run during the 2026-06-14收口 pass:

```text
npm.cmd --prefix frontend run test:admin-audit-summaries
npx.cmd tsc --noEmit --incremental false --pretty false
npm.cmd --prefix frontend run build
```

These prove the latest admin candidate-review improvements build and that the frontend audit/governance wiring remains present. They do not replace the DB-backed smoke; the final release gate still needs `npm run verify:csca-ai-questioning` against a disposable or staging database.

## Stop Rule

After this audit, do not continue with open-ended improvements. Use this decision table:

| Proposed work | Decision |
| --- | --- |
| Fixes a startup/build/test failure | Do it before release |
| Prevents unsafe learner exposure | Do it before release |
| Prevents admins from understanding or completing the current governance flow | Do it before release |
| Adds audit evidence for an existing high-impact action | Do it before release if missing |
| Makes labels, empty states, or action outcomes less misleading | Do it if small and directly tied to current flows |
| Adds a new workflow, dashboard, automation, or product surface | Defer unless it blocks current release |
| Makes the admin console prettier but not safer or clearer | Defer |
| Improves long-term architecture without changing release safety | Defer |

## Release Blocking Checklist

### P0 - Must Pass Before Release

1. `npm run verify:csca-ai-questioning` passes against a disposable or staging database.
2. `npm run verify:governance` passes.
3. Backend starts without Nest dependency injection errors.
4. Frontend production build passes.
5. Admin candidate review can complete these actions without console/runtime failure:
   - review;
   - manual fix and review;
   - approve;
   - reject;
   - archive;
   - replacement approval.
6. Generated candidates cannot enter learner-facing practice without approval.
7. Archived/rejected/review-pending AI-backed questions are not selected by adaptive practice, normal special-practice sessions, or AI Coach prompt context.
8. Syllabus version drift removes stale questions from active eligibility or routes them to syllabus review.
9. Organization BYOK secrets are not exposed in API responses, audit payloads, or frontend state.
10. Admin audit logs exist for candidate, quality, generation, syllabus, readiness, and organization high-impact actions.

### P1 - Should Finish Before Wider Rollout

1. Run one manual staging rehearsal:
   - upload/apply syllabus JSON;
   - generate candidates;
   - review one failed candidate;
   - manually fix and re-review one candidate;
   - approve one normal candidate;
   - regenerate a quality replacement;
   - approve the replacement and confirm the old question is retired.
2. Confirm admin copy is understandable in the real screens, especially:
   - candidate recommendation card;
   - candidate active filters and filtered-empty state;
   - quality replacement follow-up;
   - syllabus affected-question review;
   - readiness score explanation.
3. Confirm role boundaries for platform admin versus organization admin in current code.
4. Confirm the scheduler remains off by default in production unless explicitly enabled.
5. Add an operations note for the first rollout cohort: which subject, which organization if any, and who reviews candidates.

### P2 - Defer

1. Split `/admin/audit` into dedicated AI production, candidate review, quality governance, and syllabus pages.
2. Add richer charts for quality drift and reviewer workload.
3. Add stronger deterministic validators beyond the current first-generation set.
4. Add KMS-backed organization BYOK key storage and rotation.
5. Add SSO/domain auto-join and advanced organization lifecycle management.
6. Complete unified-bank migration for all legacy special-practice content.
7. Build a full provider-evaluation dashboard for Planner Assistant.

## What Is Considered Done

This workstream is done for release when all P0 items pass and P1 items are either completed or explicitly accepted as rollout risks.

"Done" does not mean the AI-questioning product can no longer improve. It means the team stops expanding scope and begins release validation with the current feature set.

## Remaining Release Work

The next executable step is not another feature. It is a release-gate run:

```text
npm run verify:csca-ai-questioning
npm run verify:governance
```

If either fails, fix only the failing release-blocking issue. If both pass, perform the manual staging rehearsal from P1 and record the result in this document or a dated release note.

## Appendix: Current State Summary

Already operational:

- AI-questioning module and DB models exist.
- Blueprint-driven generation exists.
- Structured syllabus scope reaches generation and review.
- Candidate review queue exists.
- Review guidance and primary recommendation cards exist.
- Candidate queue now has source/status filters, recommendation-action filters, active filter chips, clear filters, and filtered-empty copy.
- Candidate CSV/JSON export exists.
- Manual candidate fix and review gate exists.
- Quality governance, replacement candidates, stale replacement handling, and reduce-exposure behavior exist.
- Adaptive selection respects current governance boundaries.
- AI Coach context respects governed-question boundaries.
- Organization AI pool and BYOK foundation exists.
- Admin audit summaries and quick filters exist.

Known release posture:

- Admin UX is functional but dense.
- Validator depth is useful but not mathematically complete.
- Generated questions still require human review.
- DB-backed smoke is the most important proof for the production loop.
