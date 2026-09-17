# Supply-chain security status

## Phase 4B result

On 2026-09-17 the committed dependency graph was upgraded without forced major-version changes:

| Area | Before | After | Direct baseline |
| --- | ---: | ---: | --- |
| Backend | 10 findings | 0 findings | Nest 11.2.5, Express 4.22.3 |
| Frontend | 8 findings | 0 findings | Vite 7.3.6 |

Accepted release tag: `v0.1.0-alpha.2` at commit `973ff57`.

Important remediated transitive versions include Multer 2.4.0, body-parser 1.20.8, qs 6.16.0, fast-uri 3.1.8, js-yaml 4.3.2, browserslist 4.29.0, brace-expansion 1.1.21, esbuild 0.28.2, PostCSS 8.5.28, nanoid 3.3.19, Babel Core 7.29.7 and fflate 0.8.3.

## Gate

Run:

`npm run security:audit-dependencies`

The command audits backend and frontend lockfiles and fails for high or critical findings. The standalone GitHub workflow runs it after deterministic installation and before browser setup/build verification.

The dynamic registry audit remains separate from `ci:contracts` so the local core contract suite stays reproducible when offline. A new advisory may fail CI without a source change; triage it by production reachability, apply the smallest compatible update, rerun all contracts and golden paths, and document any time-limited exception rather than using `npm audit fix --force`.
