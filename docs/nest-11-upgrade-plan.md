# CSCAlite Nest 11 Upgrade Record

## Status

CSCAlite has moved the backend Nest package set to Nest 11. The previous Nest 10 production audit exceptions were removed after backend production audit returned clean.

## Package Set

These packages must remain on the same Nest major:

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/platform-express`
- `@nestjs/testing`
- `@nestjs/cli`
- `@nestjs/schematics`

Do not use `npm audit fix --force` for future upgrades. Upgrade deliberately, then run the same gates used by release candidates.

## Acceptance Gate

Nest upgrades are acceptable only if all of these pass without changing public routes or API response shapes:

```bash
npm --prefix backend run build
npm --prefix backend run test:security
npm run verify:ci
npm run verify:ops
npm run verify:supply-chain
npm run verify:cookie-only
```

Also run the staging smoke after deployment:

```bash
STAGING_BASE_URL=https://staging.example.com npm run verify:staging
```

## Risk Notes

- Recheck guard behavior around `RequiredUserGuard`, `RequiredAdminGuard`, and `OptionalUserGuard`.
- Recheck Express body parser limits and security headers in `backend/src/main.ts`.
- Recheck `@Res({ passthrough: true })` cookie behavior for auth login, refresh, logout, and logout-all.
- Remove resolved audit exceptions only after `verify:supply-chain` is clean without them.
