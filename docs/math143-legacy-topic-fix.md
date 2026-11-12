# Production solid-geometry binding correction

## Observed failure

Production round 56 used host topic 19, code `math-solid-geometry`, title
`立体几何`, requested hard difficulty. Settlement returned 201, but both
continuation and new practice returned 400 `ADAPTIVE_PRACTICE_POOL_EXHAUSTED`.
The generation-task table contained no rows. The frozen Math 1.43 catalog uses
`M-GEO-002`, so exact-code lookup skipped generation before task dispatch.

## Correction

One explicit compatibility binding maps `math-solid-geometry` to `M-GEO-002`.
Supply catalog selection, task execution and publication validation all use the
same resolver. The task retains its host topic code; publication still checks
the actual published host topic ID/code and binds inventory to that same ID.
Engine artifacts keep their original verified cell/scope and host admission gates.
No topics, existing questions, answer records or schema are rewritten. No title
matching, numeric-ID assumptions or broad fallback mappings are introduced.
Other legacy codes are deliberately not treated as solid geometry.

## Validation

- Backend TypeScript build and real frozen-plugin integrity/gate tests passed.
- In the isolated loopback acceptance database, using the production legacy
  code: generated five hard questions, checked/submitted/settled the round,
  continued to five unseen questions, repeated the continuation request and
  received the same successor. Host binding and engine cell were asserted.
- Canonical `M-GEO-002` flow is covered by the same acceptance script.
- Both flows retain generation-task ownership/deduplication/failure boundaries,
  no answer leakage before checking, and one-time answer evidence.
- Existing math, physics and chemistry bank read/check/submit checks passed.
- Provider calls 0; cost $0. No production or test-site actions performed locally.

Commands (dedicated acceptance database only):

```powershell
$env:MATH_ENGINE_ACCEPTANCE_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:56432/moodlelike_math_engine_acceptance?schema=public'
node backend/scripts/math-engine-student-live-test.cjs --legacy-topic
node backend/scripts/math-engine-student-live-test.cjs
```

## Existing production update

From a clean checkout of the reviewed commit:

```bash
bash deploy/math143-update-backend.sh FULL_COMMIT_SHA
```

The helper builds before changing service configuration, saves the private old
release environment and changes only `MATH143_RELEASE_BACKEND_IMAGE` in the
existing `/root/moodlelike-math143-git-20261112/release.env`. It recreates only
the `moodlelike-next` backend with `--no-deps --no-build`, preserving the existing
enabled engine, frontend image, migration image and all volume bindings.
It checks authenticated application readiness and engine readiness, retries
startup checks, and restores the old configuration/backend if they fail.
No migration, seed, database restoration, Nginx or test-site change is performed.

After success, choose solid geometry / hard / five questions, finish and continue
one batch in the production UI. Runtime readiness alone is not student acceptance.
For manual rollback, copy the exact configuration backup printed by the helper
back to `release.env`, then compose only `backend` using the same project/base
file/overlay shown in `deploy/math143-update-backend.sh`. Retain both images.
