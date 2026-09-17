# Root command surface

## Why this exists

The standalone repository inherited a large operational command set alongside the Agent runtime and question-production system. Removing commands by name alone is unsafe: many encode question quality gates, data migration safeguards or compatibility operations even when they are not part of the everyday student application.

`npm run audit:command-surface` classifies every root package command, checks direct script-file references, verifies root-to-root `npm run` calls, rejects unexpected duplicate commands and writes a deterministic inventory to `artifacts/command-surface.json`.

The accepted Phase 6C inventory contains 331 commands: 41 product-core, 202 question-production, 41 platform-contract and 47 compatibility-operation entries. Nothing is unclassified. The large question-production surface remains intentional for now; it is governed separately from the everyday student application rather than being mistaken for dead code.

## Categories

- `product-core`: standalone build, local delivery, release, security, data-cutover and contract commands;
- `question-production`: the retained question generation, calibration, novelty, observation and qualification toolchain;
- `platform-contracts`: adaptive learning, source profiles, readiness, governance and related platform checks;
- `compatibility-operations`: older deployment, database and release commands retained for explicit review;
- `unclassified`: forbidden in CI. A new command must be assigned deliberately before it can merge.

Classification is not a safety claim. In particular, compatibility commands may assume infrastructure or policies that predate the standalone cutover. They must not be run against production or real student data without a separately reviewed runbook.

## Growth and deletion policy

The root command budget is capped at the current governed surface. New aliases should normally be implemented inside an existing command or package rather than expanding the root namespace. Exact duplicate commands fail the audit unless their distinct operational meaning is documented in the allowlist.

Deletion requires evidence that the command has no package-script callers, no current runbook entry, no CI or deployment caller, and does not provide a data recovery or question-quality control. Historical commands are first classified as compatibility operations; they are removed only in a dedicated, reversible change.

The former root `build` alias was removed during this phase because it was byte-for-byte identical to `agent:build`. The old `verify:quality` command previously built both applications twice; it now delegates to `agent:build` once before running the frontend minimal contract.

The inherited `question-engine:plugin-bundle` and `question-engine:plugin-self-test` entries were also removed. The bundle command produced only a vendor subtree while the referenced plugin server was absent, so the pair could not create or verify a runnable plugin from this repository. The portable question engine build, test, catalog and readiness commands remain supported.

The retained `question-engine:build` entry now uses cross-platform `npm --prefix` instead of `npm.cmd`. `question-engine:portable-test` builds its required `dist/core` first, so it passes from a clean checkout without relying on an undocumented prior command.
