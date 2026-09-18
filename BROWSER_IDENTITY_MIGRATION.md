# Browser identity migration

## Product identity

Student, account and administration surfaces use the Moodlelike product name. Authentication email copy, attachment-analysis system prompts and Demo evidence use the same identity. Internal CSCA subject terminology remains a domain concept and is not treated as a product brand.

## Storage migration

New browser state is written under `moodlelike.*` or `moodlelike:*` keys. The application performs a one-way, in-browser migration for:

- access and refresh tokens;
- cached current-user data;
- locale and locale-source preferences;
- Agent task-rail width and position;
- current journey section;
- recommended/free learning mode and free-practice defaults;
- adaptive-question language;
- per-round handwriting conversation linkage.

When a new key is absent and the corresponding `cscalite.*` or `cscalite:*` key exists, the value is copied to the Moodlelike key and the old key is removed. New writes also remove their legacy counterpart. Logout clears both generations of authentication keys.

This migration does not read or transmit unrelated browser data. Legacy names remain only as explicit migration constants and can be removed in a later breaking release after the compatibility window closes.

## Non-storage compatibility

Persisted database identifiers, CSCA API paths and Prometheus metric names are outside this browser migration. They require separate server-side compatibility and observability plans before renaming.
