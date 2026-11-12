# Math 1.43: complete production-topic audit

The operator's read-only production inventory on 2026-11-12 contains 24
published math topics: 12 legacy `math-*` codes and 12 `M-*` codes. Preserve
all topic IDs, mastery histories, question-bank relations and existing answers.

| Legacy host code | Host subject area | Frozen engine cells |
| --- | --- | --- |
| math-set | Sets | M-SET-001 |
| math-inequality | Inequalities | M-INEQ-001 |
| math-function | Function concepts/properties | M-FUNC-001 |
| math-function-basic | Elementary functions | M-FUNC-002 |
| math-sequence | Sequences | M-SEQ-001 |
| math-calculus | Derivatives/calculus introduction | M-CALC-001 |
| math-plane-geometry | Plane analytic geometry | M-GEO-001 |
| math-solid-geometry | Solid geometry | M-GEO-002 |
| math-solid-vector | Vectors | M-ALG-001, only `vector_` scopes |
| math-complex | Complex numbers | M-ALG-001, only `complex_` scopes |
| math-probability | Combined probability/statistics | M-PROB-001 + M-STAT-001 + M-STAT-002 |
| math-coordinate-geometry | Spatial coordinate system | **No corresponding frozen 1.43 scope; existing bank only** |

Each `M-*` code retains its own complete cell at each of basic, medium and
hard difficulty. Selecting a specific standard probability/statistics topic
does not broaden to the combined legacy subject. Publication validates the
actual scope as well as the cell, difficulty and unchanged host topic ID/code.

## Confirmed scope gap

The spatial-coordinate host topic covers 3D coordinate distances, coordinate
planes, midpoints and sphere equations. Frozen solid-geometry volume/area
scopes are not substitutes. The frozen bundle is unchanged. This topic keeps
its existing approved question bank and answering/continuation route. Mastery
API capabilities and the practice form explicitly identify bank-only supply;
an exhausted batch returns `MATH_ENGINE_TOPIC_UNSUPPORTED`, rather than claiming
that Math 1.43 is replenishing it. Complete automatic generation for this
topic requires a future reviewed engine scope with its own solver/Oracle.

This limitation was independently checked with the existing question-engine
progress chat using the user's earlier authorization. No external messages,
production modifications, or frozen bundle changes were made by that review.

## Additional chain corrections

- The 1.43 catalog contains 60 finite-inventory scopes and 81 parameter-seeded
  scopes with no inventory row. The latter were incorrectly restricted to
  seed zero. Catalog output now distinguishes sampling mode. Parameter scopes
  sample legal seeds in 0..2147483646, finite scopes use valid inventory indices,
  and an empty finite inventory never falls back to parameter generation.
- All output still passes the frozen solver, Oracle, admission, host publication
  and exposure checks. Task metadata records actual cell, scope and seed.
- Publication locks and checks mathematical identity across alias topic IDs;
  it retries a fresh instance instead of storing a second copy under an alias.
  Selection also excludes already exposed generated identities across aliases,
  including any copies created before this correction. No old rows are deleted.
- Continuation uses the submitted artifact's topic, difficulty and batch size,
  preserving them across refresh and ignoring unrelated stored defaults.
- A successful continuation is opened even if the subsequent journey-summary
  refresh fails. Error messages retain supported shortage/scope distinctions.

## Acceptance commands

The full matrix uses real HTTP endpoints and only the dedicated migrated
loopback acceptance database. It refuses other database names/hosts, does not
load `.env`, and prevents outbound Provider requests.

```powershell
$env:MATH_ENGINE_ACCEPTANCE_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:56432/moodlelike_math_engine_acceptance?schema=public'
node backend/scripts/math-topic-matrix-live-test.cjs
```

For every supported code/difficulty it depletes existing inventory for its test
user, starts three generated questions, checks answers, saves/submits/settles,
continues three unseen questions, repeats the successor request, and answers
and settles the successor. Assertions cover host binding, exact scope, difficulty,
pre-answer secrecy, bilingual refresh, distinct mathematical identities and
unchanged selected parameters. The spatial-coordinate cases use explicitly
marked local bank fixtures and are recorded as `bank_only_pass`, never generated.
Reports are written to `artifacts/math-topic-matrix/`; incomplete or failed runs
must not be counted as acceptance. `--codes=...`, `--bands=...`, `--count=5` or
`--count=10` allow focused additional checks. No fixtures are shipped to production.

## Updating the existing deployment

Use the reviewed Git commit and a clean checkout. Run both existing helpers,
backend first, then frontend, from that checkout:

```bash
bash deploy/math143-update-backend.sh FULL_COMMIT_SHA
bash deploy/math143-update-frontend.sh FULL_COMMIT_SHA
```

Both retain `/www/wwwroot/moodlelike-next` and its existing Compose project,
volumes, release overlay, generation enablement and CSRF names. Each builds
before replacing its service, preserves the previous private release config,
and restores its prior image/config if startup checks fail. There is no schema
change, migration, seed, topic merge, Nginx change or test-site operation.
Backend restart causes a brief service interruption. Keep the printed rollback
configuration paths and old images. Never run the initial migration/deployment
procedure again for this schema-neutral update.
