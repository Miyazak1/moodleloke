# Launch Scope Decisions - 2026-05-26

## Purpose

This document records the remaining product and data-scope decisions before running final release gates. Automated validation has passed for the major technical groups, but a few release choices still need explicit confirmation so partial or unintended features are not shipped.

## Decision Summary

| Area | Recommended Launch Decision | Status |
| --- | --- | --- |
| Past Papers | Include as free published resources for this release. | Confirmed |
| Gumroad / Payments | Defer paid checkout work; keep public launch flows from depending on Gumroad. | Deferred |
| Mock Exams | Include all 22 validated mock papers as free. | Confirmed |
| School Import | Do not run for this release; keep current school data and rely on read-only validation. | Confirmed skipped |

## 1. Past Papers

Recommended decision:

- Include Past Papers in this release only for published, free resources.
- Treat all launch Past Papers as free; paid/entitled Past Papers are out of scope for this release.
- Keep `/past-papers` as the primary public route.
- Keep `/zh/past-papers` only as a compatibility alias.

Technical validation already passed:

```bash
npm run prisma:validate
npm run backend:build
npm run verify:backend
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
node scripts/past-papers-smoke.cjs
```

Remaining release checks:

- Manually create a draft paper, upload a PDF, publish it, download it publicly, then archive it and confirm the public page no longer serves it.
- Confirm launch data is allowed to be distributed.
- Confirm all published Past Papers remain free in launch data.

## 2. Gumroad And Payments

Recommended decision:

- Defer Gumroad/payment launch work until a later pass.
- Keep public launch flows from depending on Gumroad checkout.
- Keep payment entry points feature-disabled, hidden, or clearly non-blocking until paid checkout is intentionally enabled.

Technical validation already passed:

```bash
node scripts/payments-gumroad-smoke.cjs
npm run verify:backend
npm run verify:ops
npm run verify:concurrency
```

Security behavior already covered:

- Gumroad sale verification rejects refunded, chargebacked, and disputed sale states.
- Missing verification token is rejected.
- Verification fetch failures are logged without storing secrets.
- Free-order payment updates are transactional.

Remaining release checks:

- Confirm production Gumroad credentials and verification token are not required for the free launch path.
- Confirm public UI copy does not advertise checkout if checkout is not included.
- Re-run Gumroad staging callback and replay checks before any later paid checkout launch.

## 3. Mock Exam Free Scope

Recommended decision:

- Launch all 22 validated mock papers as free.
- Keep paid/locked mock-exam packaging out of this release unless a later product decision changes the scope.

Technical validation already passed:

```bash
npm run mock-exams:validate
npm run special-practice:validate
npm --prefix frontend run build
```

Validation result:

- `mock-exams:validate` confirmed 22 free mock papers with 48 questions each.
- `special-practice:validate` confirmed CSCA special practice topics and questions.

Remaining release checks:

- Confirm no public copy claims official real exam content.
- Confirm generated answers and explanations are acceptable for launch.
- Confirm seed/content state keeps all 22 launch mock papers free.

## 4. School Data Import

Recommended decision:

- Do not run `npm run schools:import` for this release.
- Keep the current school data as the launch dataset.
- Continue using read-only/public route validation for schools, search, compare, scholarships, city guides, and timeline pages.

Reason:

- `schools:import` writes/upserts `School` and `SchoolRaw` rows.
- The source JSON and target database need explicit data-ops review before use.
- Running it is not required if current school data is already the intended launch dataset.

Already validated without import:

```bash
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Suggested execution order after confirmation:

```bash
npm --prefix frontend run test:e2e -- e2e/public-routes.spec.ts
```

Remaining release checks:

- Confirm public search, school list, school detail, compare, scholarship, and city/timeline pages render against the current launch dataset.

## Final Gate Recommendation

After the four decisions above are confirmed, run:

```bash
npm run verify:release
npm run verify:release-window:local
```

If either command is too broad for the current machine state, run the documented sub-gates individually and record exceptions in `docs/launch-worktree-triage-2026-05-26.md`.
