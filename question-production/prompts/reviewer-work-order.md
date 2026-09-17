# Blind reviewer work order — pilot-30

Review every JSON file in `question-production/batches/pilot-30/blind/` independently. This task must start from the generator's `blindCommit`, before the sealed-answer commit exists in its history.

## Required method

- Never request, infer from repository history, or search for sealed answers, generator reasoning, answer keys, or official/past-paper question bodies.
- Solve each question from first principles. Compute or prove all four options, actively seek a second correct option, test condition sufficiency, definition domain, units, rounding, ambiguity, syllabus alignment, declared difficulty, and whether the case information is meaningful.
- Use an independent calculation or a small reviewer-owned script when useful. Do not call the generator's answer-producing path as a substitute for independent reasoning.
- Return `abstain` whenever a conclusion cannot be established. Never relax a gate to achieve the target count.
- Write one `reviews/<candidateId>.review.json` conforming to `blind-review.schema.json` for every blind candidate and a `reviews/reviewer-manifest.json` summarizing counts and reason codes.
- Do not edit blind questions. Do not publish or write to the database.

Commit only `reviews/` and any reviewer-owned calculation scripts under the batch directory. Report the exact commit hash, branch, pass/reject/abstain counts per subject, and recurring defects.

