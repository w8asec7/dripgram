# Phase 2 services: implemented architecture

Read root PHASE2_STATUS.md for verified results, remaining tasks and the live-call ledger. The prior Phase 1 boundaries are retained; real implementations now live behind them.

Current runtime: Expo SDK 58, React Native 0.88, React 19.3. See SDK_UPGRADE.md for upgrade verification. Provider contracts and backend credentials are unchanged.

## Runtime composition

AppProvider injects `liveServices` for Firebase users and `demoServices` for explicit demo accounts. `src/services/backend.ts` implements the same AIService/ShoppingService interfaces as mocks. `src/services/api.ts` sends fresh Firebase ID tokens to the trusted backend. The app never imports server configuration or privileged provider clients.

`server/app.ts` composes Fastify, Firebase JWT verification, Zod contracts, per-user rate limits, Firestore owner-scoped reads, Meta, SerpApi, private Supabase, hashed disk caching and persisted usage counters. Firestore REST requests use the caller's Firebase token; database security rules remain active, rather than being bypassed by an admin credential. `shared/protocol.ts` defines validated transport contracts.

## Actual endpoints

All `/v1/*` routes require `Authorization: Bearer <Firebase ID token>`.

| Method / path                          | Behavior                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET /health                            | Public configuration booleans/model; does not prove live provider availability           |
| GET /v1/usage                          | Backend attempt/token counts, configured caps; no invented credit balance                |
| POST /v1/ai/analyze                    | Validated bounded inline image → editable recognition metadata                           |
| POST /v1/ai/outfit                     | Fetch actual owned garments; grounded outfit or incomplete-wardrobe guidance             |
| POST /v1/ai/wardrobe                   | Owned inventory → wardrobe-first observations                                            |
| POST /v1/ai/group                      | Authorize occasion membership; use only explicit submitted snapshots                     |
| POST /v1/ai/occasion                   | Brief dress code interpretation                                                          |
| POST /v1/shopping/search               | Normalized Shopping search, filters and timestamp                                        |
| POST /v1/shopping/visual               | Validated image → temporary private signed object → Lens → exact object cleanup          |
| GET /v1/shopping/products/:id          | Previously observed listing, optional real merchant enrichment, private persistence      |
| POST /v1/shopping/compare              | Fetch caller's saved/observed products; UI comparison limited to four                    |
| POST /v1/shopping/products/:id/refresh | Search same offer; verify provider/merchant identity and currency before new observation |
| POST /v1/shopping/products/:id/advice  | Actual product + owned inventory; validate every referenced garment ID                   |
| POST /v1/images/thumbnail              | Authorize existing owned garment, sanitize image, upload compressed thumbnail            |
| POST /v1/images/sign                   | Verify owner or explicit friendship/occasion permission before 300-second URL            |
| DELETE /v1/images/thumbnail            | Owner-only exact thumbnail removal while garment record still exists                     |

Input errors, authentication expiry, rate limits, malformed provider data and timeouts return stable plain-language error envelopes. No provider raw bodies, tokens, keys, photos or signed URLs are logged. There are no automatic provider retries.

## Meta Model API

Central config: official base `https://api.meta.ai/v1`, `META_MODEL=muse-spark-1.2`, Standard mode. The configured account's model listing confirmed availability; image recognition and grounded outfits succeeded. Contributor variants are rejected. Do not switch providers or data-use terms automatically.

Chat-completions uses inline `{type: image_url, image_url: {url: data:image/jpeg;base64,...}}`, configurable minimal reasoning effort (low alternative), bounded max_completion_tokens and strict JSON Schema generated from Zod. `none` reasoning is unsupported for this model; 900 tokens truncated an outfit during testing, and Phase 3’s expanded recognition also sometimes exhausted 1600 including reasoning; the current configurable default is 2400 with minimal reasoning. Output is validated before use; brands/materials may be null and uncertain attributes remain editable.

Outfits receive compact metadata, not all photos. The structured schema constrains top/bottom/optional roles to real available garment IDs. Replacement preserves other selected roles and excludes the prior item where alternatives exist. A second grounding pass checks ownership, availability, categories, roles, duplicate IDs and dress code. Model output never authorizes access or fabricates owned clothes.

Images and prompts are cached by UID/hash; concurrent identical requests deduplicate. Cache filenames are hashes; original inference images are not retained. Token usage is whatever the provider actually reports, not a balance estimate.

Official references: https://dev.meta.ai/docs/models, https://dev.meta.ai/docs/image-understanding, https://dev.meta.ai/docs/structured-output, https://dev.meta.ai/docs/protocols/chat-completions.

## SerpApi

Shopping: `engine=google_shopping`, US/English; query includes category/color/style/fit/brand/size/occasion. Results preserve title, actual merchant, observed price, genuine URL, thumbnail, rating/reviews and provider identifiers. Missing values are null; unsupported currencies are excluded instead of being compared to USD. On-sale filtering requires a provider-supplied higher original price. Unknown attributes/similarity/compatibility percentages are never invented.

Lens: `engine=google_lens` with a short-lived signed sanitized image URL. **Do not use `type=products`: current API rejects it as discontinued.** Temporary objects are removed in finally blocks. Entire wardrobes remain private. Explicitly explain to users that requesting visual search sends this reference to the provider.

Optional merchant enrichment uses `google_immersive_product` and the actual returned token. If no matching merchant offer exists, preserve the real Google product listing and label the link accordingly. Cache both successful and unavailable enrichment so opening a detail screen does not repeatedly spend credits.

Search cache: 30 minutes; merchant cache: one hour; manual refresh dedup: one minute. No search-on-render for signed-in users. Search buttons submit explicitly. Approximate provider attempt usage is persisted; failed requests may still count toward the configured local cap.

Official references: https://serpapi.com/google-shopping-api, https://serpapi.com/google-lens-api, https://serpapi.com/google-immersive-product-api.

## Private Supabase thumbnails

Use the existing **hackTx** bucket, case-sensitive and private. Server supports `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`. Supabase URL is normalized to its project origin, so a pasted `/rest/v1/` suffix does not break Storage routing. No bucket, account, API key, permissions or billing changes are necessary.

The app resizes inference images to fit within 1024 pixels and thumbnails to approximately 256 pixels with aspect preserved. Native thumbnails are copied into persistent app document storage; web uses owner-scoped browser storage. Server Sharp sanitizes/rotates the input, bounds inference to 768px JPEG 75, and makes a padded 256×256 compressed JPEG without paid transformations. Only app-created temporary cache files are cleaned; camera-roll photographs are never deleted.

Save order: local thumbnail + pending garment → Firestore metadata → authenticated Supabase upload → Firestore synced metadata. A stable garment ID survives retries. Failure preserves the local copy and accurately marks pending/failed state. Settings refresh merges pending local garments. Garment detail offers Sync photo / Sync garment details. The renderer prefers local thumbnails; cross-device access renews authorized signed URLs and retries one expired URL. Delete the cloud thumbnail before removing its authorizing record.

Object: `users/{uid}/garments/{garmentId}/thumbnail.jpg`. Short-lived Lens objects are separate. The backend ignores client-supplied owner claims for writes and checks Firestore ownership/explicit sharing before reads. Being friends never grants full wardrobe access. Signed URLs are bearer capabilities for their five-minute lifetime; do not log or treat them as permanent URLs.

## Price watches and deferred integrations

Watches persist product snapshots, target, checked timestamp, observed history and sync errors. Manual refresh verifies the same merchant/offer/currency; failed verification preserves history. No automatic scheduler or remote price-drop notification delivery is configured. Calendar remains manually managed/disconnected. Local reminders are device-dependent. Advanced trends, scheduled cleanup of old occasion subcollections, remote push and production hosting are deferred.

## Testing and phone use

Run deterministic app/backend/rules/E2E suites first. Opt-in real smoke tests are documented in README and use only synthetic fixtures; do not spend credits in default tests. Negative coverage includes invalid tokens/signatures/expiry/audience, foreign wardrobe/image access, malformed uploads/AI, grounded IDs, currency safety, cache races and quotas. See docs/MANUAL_QA.md for LAN/Expo Go instructions. **Do not automate physical camera capture.**

Latest refinement: conversation image authorization additionally accepts `chat:{kind,id,messageId}` on `/v1/images/sign`; Firestore membership and selected attachment ownership are enforced before signing. See `docs/REFINEMENT_STATUS.md` and AGENTS section Q for current recognition budgets/recovery and chat APIs.
