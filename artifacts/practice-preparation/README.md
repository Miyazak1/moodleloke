# Preparation transition acceptance

- Actual loopback student UI against the isolated acceptance database.
- Existing inventory was marked seen for the dedicated test user only, forcing
  verified generation rather than an immediate bank-only response.
- Started three hard complex-number questions: animated preparation card,
  actual elapsed seconds, disabled launch button, then automatic entry.
- Answered/submitted round 287, continued three hard complex-number questions:
  previous result stayed visible, preparation status and saved-result note
  appeared, launch/configure controls were disabled. Automatically entered
  successor round 288 with zero preparation cards remaining.
- Verified document width equals viewport at 320 and 390 pixels; observed actual
  CSS floating-paper and spinner animations. Captured wide and phone views.
- No backend, database schema, production or test-site deployment change.

`preparing-1440.jpg`: real initial preparation state.
`continuing-390.jpg`: real continuation feedback with saved-result note.
`practice-after-preparation-320.jpg` and `transition-completed.jpg`: actual
automatic transition into ready questions after the preparation card disappeared.

Frontend application code: `8e4085c307f99a60e40d1a254a6038fd4c802e6a`.
Full contracts and browser golden CI passed: run `43237187317`.
Production frontend image built and Nginx configuration verified:
`sha256:f948517225bfb188ef24d51b0ef1c287cd6a34d8cf9b59e122e9a0ac5d29fe65`.
