# Release E — New-user activation and first learning loop

Date: 2026-10-08

## Product contract

The supported path is:

`public site → register/login → optional email verification → onboarding → Learning Agent → first answer → first completed round`

Email verification remains strongly encouraged for account recovery and sensitive capabilities, but it is not a hard gate for the first non-AI learning round. The permission exception is intentionally narrow:

- authenticated users may read the Agent journey and start its prescribed practice;
- authenticated users may use the adaptive non-AI round endpoints;
- AI conversations, attachments, organization controls, provider configuration, and other cost- or trust-sensitive routes retain the verified-user default.

## Server-authoritative milestones

The existing `csca_training_events` table records idempotent, per-user activation milestones with source `activation`:

- `onboarding_completed`
- `onboarding_skipped`
- `first_answer_submitted`
- `first_round_completed`

Writes are serialized with a PostgreSQL advisory transaction lock. Repeated browser requests therefore do not inflate the funnel.

## Admin observability

The admin training overview reports a student registration cohort for the selected time range and its current progression through:

1. registration;
2. email verification;
3. onboarding completed or skipped;
4. Agent entry;
5. first answer;
6. first completed round.

It also reports median minutes from registration to first answer. No email address, question text, answer content, or client error body is exposed in this view.

## Acceptance

Run:

```bash
npm run activation:test
npm run frontend:build
```

The activation self-test verifies the narrow route policy, continued-unverified UI contract, milestone idempotency, and cohort aggregation.
