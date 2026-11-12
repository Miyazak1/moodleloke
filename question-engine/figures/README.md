# Student question figures

This is a server-side presentation boundary for the existing Moodlelike practice
flow. It does not register another formal generator, publish questions, start a
Lab reader/server, or authorize any deployment.

`presentation.cjs` returns a whitelisted display object for a **server-owned**
`question` or `review` phase. The host derives this from persisted submission
state. Review figures remain hidden after an individual answer check until the
round is submitted. Unsubmitted report requests are rejected.

For stored Math 1.43 questions, the original candidate, artifact, source,
fingerprint, identity, gate and teaching evidence are reverified with the frozen
`beforeStore` contract before rendering. Host publication/content binding is also
required. Complete old stored records work without regenerating a question.
Incomplete or unsupported optional records keep the original text.

The diagram archive has SHA-256
`48ea6def723eec29957de583b6371492477f88f27365906627b0ff7224b32574`.
Only nine rendering dependencies from that archive are under `../diagrams/`;
`frozen.cjs` now uses the host's fixed verified runtime. Reader/server scripts and
held-out data are not in the runtime adapter or frontend public directory. The
original development archive and local verification copy retain the upstream
evidence; those contain answers and are not student payloads.

## External source boundary

`binding.cjs` binds an original to its actual source, question version, public
content, bytes and display phase. `approveOriginal` handles restricted SVG;
`approveOriginalBitmap` actually decodes PNG/JPEG before signing, with size and
dimension limits. These are **trusted host review ports**, not student HTTP
endpoints. The reviewer must verify original ownership/version, mathematical
content, caption and permitted phase. A media signature is not question
publication or mathematical qualification.

The key is provided by the trusted host; presentation uses `AUTH_SECRET` by
default. Do not put it in browser code or print signed private manifests. Retain
the original source/asset and previous versions when attaching a reviewed image.
Changing a bound version, translation, asset or signature rejects the image.
Key rotation requires resigning affected original/fact-review records.

`external.cjs` extracts only complete, strict public statements. It never uses an
answer key to infer geometry and never constructs a Math Lab artifact/admission.
Two exact historical source/version/content bindings were locally audited in
`external-reviewed.json`. Other compatible public-source types require the
separate `approveExternalFacts` review signature. This is not a blanket approval
of every `external_oer` row. Unverified translations disable redraw.

Prefer a usable, reviewed original. Otherwise use verified public facts for a
redraw. An optional unsupported image falls back to text. Explicitly required,
missing or mismatched images are excluded from selection and logged as
`required_figure_unavailable` in `csca_adaptive_inventory_events`, including
source, question ID, version and reason. Neither archive/delete nor altered
question status is used as a quarantine shortcut.

## Reading pilots

`reading-pilots.cjs` implements local experimental piecewise-range and
frequency-mean candidates. It is not in the formal plugin registry and does not
modify the frozen 1.43 scopes or claim its admission. The feature flag defaults
off. Local acceptance fixtures can opt in; published-bank, topic and ordinary
practice rules still apply. These candidates cannot be selected for independent
verification or diagnostic rounds and carry conservative learning confidence.

The intended answer is calculated from construction parameters. A separate
solver reads the **final SVG**: printed ticks, line endpoints, open/filled
markers and isolated points, or bar dimensions and category labels. It recomputes
the range/weighted mean. A second binding also rejects changed plots whose answer
happens to stay the same. Current capacity is deliberately a pilot: three
geometry/frequency parameter sets with four option rotations, not a broad or
student-calibrated reading-question engine.

Run `npm --prefix question-engine run figures:test`. Full source inventory,
real-student acceptance and mobile reproduction are documented in
`docs/question-figures-integration.md` and the local coverage artifact.
