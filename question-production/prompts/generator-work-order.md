# Generator work order — pilot-30

Generate 45 candidate questions for `question-production/batches/pilot-30/batch-plan.json`: 15 each for math, physics, and chemistry. The eventual accepted target is 10 per subject, so quality and diversity matter more than keeping every candidate.

## Boundaries

- Do not modify application source, Prisma schema, migrations, package scripts, existing docs, or the other automatic-question-generation implementation.
- Do not open or search official/past-paper question bodies, including filenames containing `past-paper` or source JSON question corpora. You may inspect published syllabus metadata, QuestionPlan policies, local generators, Solver/Oracle implementations, and their self-tests.
- Do not use a historical official question as a template. Create original wording and scenario structure.
- Every item must be independently solvable, have exactly four options and exactly one correct answer.
- Prefer scopes already supported by deterministic tools in the repository. If an intended family is not actually supported, record the limitation and replace it only with another supported family in the same subject; do not invent validator evidence.

## Output and two-commit blindness protocol

1. Create `blind/<candidateId>.json` containing all fields needed to solve the question, but **never** include `correctAnswer`, `explanation`, option correctness, generator reasoning, or a filename/order that reveals the answer.
2. Validate all 45 blind files for four unique A–D options and declared batch counts.
3. Commit only the batch plan/protocol additions if present and `blind/` files. Report this as `blindCommit`.
4. Then create `sealed/<candidateId>.json` conforming to `question-candidate.schema.json`, plus `sealed/generator-manifest.json` with counts, family distribution, content hashes, calculation evidence and any generator-side rejection/replacement history.
5. Commit only the new `sealed/` files. Report this as `sealedCommit`.

Do not merge, publish, write to the database, or mark anything approved. In the final response, report the exact two commit hashes, current branch, counts per subject/family, and any limitations. The two commits must be separate so the blind reviewer can start from `blindCommit` without access to sealed answers.

