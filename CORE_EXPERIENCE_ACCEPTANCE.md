# Core experience acceptance

This gate protects the student learning loop that Moodlelike will provide to CSCALite.

## Release-blocking journeys

| Journey | Required outcome |
| --- | --- |
| Student-initiated practice | Starts the selected subject and batch without creating or mutating a recommendation. |
| Evidence-driven recommendation | Explains why another subject may be prioritized, preserves the free-practice default, and starts the exact prescription. |
| Current-question assistance | Keeps one question-scoped context, streams the grounded answer after the student's message, and never imports another question or standalone Q&A history. |
| Mistake review | Shows the concrete wrong answer and explanation before enabling a fresh-question verification. |
| Independent verification | Persists the result, distinguishes one successful round from stable mastery, and exposes the next due action. |
| Read-model recovery | Keeps the workbench usable and offers an in-place retry without losing the current route. |

Every journey must pass on desktop and mobile. Authoring remains a desktop-only release check because it is an operator surface, not a student learning surface.

## Commands

- `npm run ci:golden` — core desktop/mobile journeys plus the desktop authoring golden path.
- `npm --prefix frontend run test:e2e:golden:core` — core student journeys only.
- `npm run ci:contracts` — build, runtime contracts, integration preflight self-test, and release baseline.

Any skipped core scenario, unexpected legacy locale route, leaked cross-question context, non-recoverable error, or mobile-only failure blocks CSCALite rollout.
