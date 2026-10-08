# CSCAPilot Release A public-contract baseline — 2026-10-08

## Scope

This release aligns the public CSCAPilot promise with the standalone Learning Agent product:

- CSCAPilot is the primary product identity;
- the primary call to action enters the Learning Agent;
- the 12-question homepage experience is a quick diagnosis, not a full mock exam;
- retired CSCALite learning URLs resolve to the matching Agent workspace;
- public routes expose readable initial HTML and route-aware metadata;
- private learning, account, onboarding, and authentication routes are not indexed.

The baseline commit before this work was `7ca2699 feat: restore CSCA preparation guide` on `main`.

## Canonical public routes

| Route | Search policy | Purpose |
| --- | --- | --- |
| `/` | `index,follow` | CSCAPilot public home and quick diagnosis |
| `/csca-prep` | `index,follow` | CSCA exam introduction and preparation guide |
| `/agent` | `noindex,nofollow` | Signed-in or anonymous Learning Agent workspace |
| `/auth` | `noindex,nofollow` | Authentication |
| `/onboarding` | `noindex,nofollow` | Initial learning setup |
| `/me` | `noindex,nofollow` | Personal settings and learning record |

Compatibility routes:

- `/csca-mock-exam/*` → `/agent?agentSection=progress`
- `/past-papers/*` → `/agent?agentSection=resources`
- `/csca-subjects/{math|physics|chemistry}` → `/agent?mode=free&subject={subject}`
- `/csca-special-practice/*` → `/agent?agentSection=practice`

## Release gates completed locally

- `npm run frontend:build`
- `npm --prefix frontend run test:standalone-shell`
- `npm --prefix frontend run test:minimal`
- `npm --prefix frontend run test:i18n-messages`
- `npm --prefix frontend run test:i18n-debt`
- `npm --prefix frontend run test:e2e:golden:home`
- `npm --prefix frontend run audit:standalone-reachability`

The production build must contain both `dist/index.html` and `dist/csca-prep/index.html`, with distinct titles, descriptions, canonical URLs, and readable non-JavaScript body copy.

## Production checks before cutover

1. Back up the production database and record the image tags and Git SHA.
2. Build and recreate the frontend container.
3. Confirm `/api/v1/ops/ready` returns `status: ready`.
4. Fetch `/` and `/csca-prep` without browser JavaScript and confirm CSCAPilot text is present.
5. Confirm `/agent` renders `noindex,nofollow` after the application loads.
6. Confirm every compatibility route above lands in the intended Agent workspace.
7. Switch Chinese, English, and Vietnamese on the public home and verify no language residue.
8. Verify desktop and mobile entry into the Learning Agent.

## Rollback

Retain the previous frontend image until the public-route smoke checks pass. A rollback only needs to restore the previous frontend image; this release does not change the database schema or production data.
