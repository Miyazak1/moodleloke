# CSCALite Question Engine

This package is the extraction boundary around CSCALite's verified automatic-question system.
It exposes a stable read-only API over
the versioned QuestionPlan, generator, solver, independent-oracle, explanation-verifier and release
evidence contracts already used by CSCALite.

Phase 1 deliberately exposes only:

- capability and exact-plan discovery;
- the consolidated release-readiness report;
- read-only, zero-provider qualification-batch previews.

It does not expose observation execution, candidate writes, Provider calls or student publication.
Those capabilities remain inside the extracted Moodlelike workspace until a later extraction phase defines separate scoped
authorization and storage adapters.

Phase 2 makes the mathematical derivative Tool Verifier, Solver, Independent Oracle and Explanation
Verifier canonical under `question-engine/core`. Their former backend paths are compatibility
facades, so existing CSCALite imports resolve to the same function objects and version strings remain
unchanged. Frozen source identity now belongs to the canonical core file; a versioned migration
manifest records the old and new hashes, and the random-property evidence checks both the canonical
hash and the facade target.

Phase 3 moves the mathematical derivative Generator algorithm into `question-engine/core`. The
host's full QuestionPlan validation and adherence policy is injected through two explicit ports;
the backend file is only a compatibility binding. This keeps the core algorithm independent without
copying CSCALite's large policy module. The Agent plugin also exposes one in-memory, triple-verified
derivative preview tool. It performs no Provider call, database write, observation task, or publication.

Phase 4 moves the physics-kinematics and chemistry-acid/base Generator, Solver, Independent Oracle,
and Explanation Verifier chains into the same core. Their QuestionPlan and provisional-scenario
checks use explicit host ports. The plugin now offers offline previews for all three migrated subject
families while keeping execution, persistence, Provider, and publication capabilities absent.

Phase 5 moves the remaining registered math-elementary and math-line-relation chains into the core.
All five production-shadow registry families now have canonical Generator/Solver/Oracle/Explanation
implementations under `question-engine/core`; CSCALite keeps policy binding, persistence, and release.

Phase 6 exposes an offline preview tool for every registered family. The plugin has five generation
preview tools plus catalog, readiness, and qualification preview. All generation is in-memory and
unpersisted; no execution, Provider, database-write, or publication tool exists.

Phase 7 centralizes the remaining CSCALite policy dependency in the versioned
`adapters/cscalite-host.cjs`. Runtime code consumes only four host ports: plan construction,
validation, adherence, and provisional-scenario validation. The adapter explicitly has no database,
Provider, or publication access.

An initial `adapters/portable-host.cjs` implements the same ports for offline exact-plan previews.
It is deliberately marked offline-only: it cannot qualify production evidence or materialize dynamic
scenarios, and it fails closed for unregistered families.

Phase 9 adds an ES2022 package build, a backend-free portable runtime, and the
`cscalite-question-engine` CLI. The distributable package contains compiled core JavaScript,
declarations, the portable adapter, and offline runtime only. Catalog, readiness, and qualification
remain available through the optional `@moodlelike/question-engine/cscalite` export inside the standalone Moodlelike workspace.

The historical Codex plugin wrapper is not part of this standalone repository. Plugin packaging must
be maintained as an independent, complete deliverable rather than creating a partial `plugins/`
directory inside the product checkout.

Run `npm test` in this directory, or use the root script `question-engine:test`.

`CSCALITE_ROOT` is a retained compatibility variable that may point to the current Moodlelike
checkout. When unset, the package resolves the repository root relative to its own source location.
