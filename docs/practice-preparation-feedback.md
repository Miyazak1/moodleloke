# Practice preparation feedback

The free-practice continuation endpoint returns after it has matched inventory,
prepared any missing verified questions, checked novelty/publication and loaded
the round. Missing questions are generated serially. Diagram preparation is one
part of presentation; text-only questions can also take time. Production phase
timings have not been measured, so the UI does not claim which backend substep
is currently running or show a fabricated completion percentage.

Starting and continuing practice now show a nonmodal animated preparation card,
actual elapsed time, batch size and automatic-entry guidance. Continuation
distinguishes the real settlement request from the preparation request and says
that submitted results remain saved. After 20 seconds the message acknowledges
the longer wait. All timers stop on completion/failure; retry starts a fresh timer.
The transition adds no intentional delay and stops before the new round opens,
independently of the subsequent background journey-summary refresh.

Continuation/targeted-start controls are disabled while preparing, and the page
guards start/continue/configure actions against overlapping launch requests.
The status announcement excludes the ticking timer. System reduced-motion
preferences disable the decorative animation. Chinese, English and Vietnamese
messages use the same keys.

Regression coverage holds start/continue responses pending, checks visible
feedback, correct batch size, disabled duplicate actions, absence of fake
percentage and cleanup after both success and failure. Existing request payload
and stored-default independence assertions remain in place.

This change affects the frontend only. Use the reviewed commit with
`deploy/math143-update-frontend.sh`; there is no backend or database change.
Previous release configuration is saved by that helper for frontend rollback.
