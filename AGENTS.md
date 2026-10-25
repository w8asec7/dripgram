# DripGram — required agent handoff

## A. Project overview

DripGram is **an AI-powered social fashion platform that connects your wardrobe, outfit inspiration, and real-time shopping** for HackTX2026. Core journey: **discover a look → recreate it with owned clothes → shop missing pieces → share fits**. Target users want style inspiration and connection without cataloguing their entire wardrobe. Sponsor targets: Best Use of SerpApi; Meta Bringing People Closer Together with AI; Best Overall. **No Jester/comedy features.**

Principles: optional short onboarding; photo/voice/text additions with review; private closets by default; explicit public/friends-only posts; real owned IDs in recommendations; honest substitutions and sample provenance; compressed private imagery; secret-free frontend; cached, cost-conscious providers. Four tabs are Feed/Closet/Discover/Profile; Feed is the default for returning sessions. Messages live behind the Feed header; Style Me floats above the feed. Laundry/essentials/check-in UX is retired; preserve its stored legacy fields/history. Section W and SOCIAL_FIRST_STATUS.md describe the current implementation; older feature inventories below are historical context.

## B. Complete feature inventory

Historical Phase1 inventory (retired inventory UX is not active; see section T):

- Welcome; email/password sign-in/sign-up/reset forms; profile setup/editing; persisted onboarding; style, size, budget, brand, color and shopping-priority preferences.
- Explicit offline demo: main user, 18 garments, two friends, an incoming request, a searchable extra user, essentials, saved looks, two occasions, intentional shared snapshots, sample notifications, products and a price watch. Seed restoration requires confirmation.
- Four persistent Home / Closet / Discover / Social tabs; nested details, forms and sensible back routes.
- Closet search, category/color/style/availability/favorite filters; garment creation/edit/delete; local photo/library/capture entry points and review; editable mock attributes; favorites; per-friend garment permissions.
- Quantity-based custom essentials; total/clean counts; bulk laundry; reusable/available/laundry/unknown states; confirmed wear history; planned outfits and daily check-in, including extras and skip without invented wear events.
- Occasion/dress code/color/style outfit inputs; deterministic role/category/availability rules; incomplete-wardrobe guidance; swaps; saved looks; planning and confirmation; wardrobe-first observations and optional gap search.
- Sample product/manual/visual search; clearance filters/sorts; saved searches; product details; comparisons; target-price watches and sample history; retailer links with sample disclaimers.
- Friend lookup/requests/accept/reject/remove; public minimal profiles; explicit shared garment projections; private occasion invitations, participant acceptance, shared outfit snapshots, voting, comments, themes and sample group coordination.
- In-app notification records/preferences; supported-device local 8 PM reminder with fallback; manual occasions; explicitly disconnected calendar interface.
- Phase 2 removes the Phase 1 Style court route. No Jester features are active.

Phase 2 implemented: Firebase-authenticated Fastify backend, live Standard Muse Spark vision and grounded garment-ID outfits, wardrobe/group/shopping advice endpoints, live SerpApi Shopping/Lens and optional merchant enrichment, private Supabase thumbnails in the existing **hackTx** bucket, local compressed thumbnails, upload retry, offline garment retention, observed manual price refresh, usage/caching/deduplication/budgets and service status UI. Signed-in accounts select live adapters; explicit demo remains fully mocked and offline. Live-service failures never silently become demo results.

Deferred: automatic price scheduler, push delivery, calendar OAuth, portrait uploads, production hosted backend/builds, advanced trends. Camera capture and physical-device gallery remain user verification tasks. Expo Go requires SDK 58 compatibility and a LAN-reachable backend. See PHASE2_STATUS.md for actual test results, provider verification and known limitations.

## C. Architecture

Expo **SDK 58**, React 19.3, React Native 0.88.0, TypeScript, Expo Router, Reanimated/Gesture Handler, Expo Image, ImagePicker, SecureStore, AsyncStorage, React Hook Form and Zod. Requires Node 22.13+ (or supported newer even LTS), TypeScript 6, Jest 30 and React Native Testing Library 14 / test-renderer. UI renders/events must be awaited. Reanimated tests use its official Jest resolver and setUpTests; do not restore the old native animation mock. See docs/SDK_UPGRADE.md. Native packages are installed with `expo install`; do not independently upgrade them outside SDK compatibility.

- Web preview/export uses SPA (`web.output: single`) and eager web routes to avoid an SDK 58 development SSR reload regression. Static hosts need an index.html fallback. See docs/SDK_UPGRADE.md before changing rendering mode.
- `src/app`: routes. `_layout` supplies safe areas, gesture root, app provider, Stack and toast. `(tabs)` supplies four bottom tabs. Guard private routes through session/data state.
- `src/components`: themed primitives, image fallback, cards, fields, buttons, chips, garment/outfit/occasion/product presentation.
- `src/theme`: centralized color/type/spacing/radius/shadow/duration tokens. System sans + Georgia/serif.
- `src/models`: all validated records, stable ID/time helpers and category labels.
- `src/repositories/contracts.ts`: AuthRepository, DataRepository, typed Command and KeyValueStore.
- `domain.ts`: pure validated state transitions, ownership checks and explicit permissions. Never bypass it for convenience.
- `mock.ts`: deterministic local data, serialized atomic commands and persistent demo/session adapters. Corrupt data/storage failures propagate.
- `firebase.ts`: Firebase auth and per-owner Firestore adapters; serialized client commands; revision-checked transactions. Image storage now uses the authenticated backend and private Supabase, not Firebase Storage. Cloud errors never silently become mock successes.
- `authPersistence.native.ts`: Firebase's persistence interface backed by SecureStore. Web uses Firebase browser persistence. Demo session is in SecureStore on native; wardrobe demo data is in AsyncStorage.
- `src/state/AppProvider.tsx`: session bootstrap, repositories, data, action/loading/error/notice state, operation timeout and network state. Successful repository results become application state; failed writes do not optimistically claim success.
- `src/services`: AI/shopping interfaces with deterministic demo adapters and live backend adapters, image preparation/local persistence, camera and notification boundaries, disconnected calendar interface. `services/index.ts` is the injection point.
- `src/hooks/useAsyncResource.ts`: cancel-safe loading/error/retry for product service reads.
- `src/mocks`: repeatable seed, sample catalog and static image lookup. Screens must not import mock catalogs to fetch products.
- `assets/photography`: licensed locally bundled real photos. Provenance: sources.json and assets/LICENSE.md; representative demo images are labeled. Fetch/crop scripts replace the retired drawing generator. Never restore illustrated/animated/generated fashion imagery.
- `shared/protocol.ts`: cross-boundary Zod contracts. Never import server modules into the mobile app.
- `server`: Fastify endpoints, Firebase JWT verification, Firestore requests under the actual user's ID token, bounded provider clients, disk cache and usage limits. Secrets load only in server/config.ts. Ignored server/.data contains private cached records/counters; never commit it.
- `tests`: unit, repository/image integration, React Native component, Playwright journey and emulator security suites. `server/tests` tests providers and authorization with fixtures; these never consume credits.

Firebase internal app/app-compat versions are pinned through overrides to prevent duplicate app registries (which caused “Component auth has not been registered yet”). The grpc override removes an available transitive security fix gap. Tar is overridden to a patched version for development tooling. Do not remove these without rerunning live auth and security tests.

## D. Data models and Firestore relationships

All external records pass Zod. Core schemas include User, Profile, StylePreferences, Garment/GarmentImage, EssentialsCategory, WearEvent, Outfit/OutfitItem, Occasion/OccasionParticipant, FriendRequest/Friendship, SharedGarmentPermission/SharedPiece, Product/ProductOffer, PriceWatch/PriceSnapshot, ShoppingSearch and NotificationPreference/Notification. AppDataSchema validates a full repository snapshot.

Availability is explicit: `available`, `reusable`, `laundry`, `unknown`. Only available/reusable pieces are recommended. A confirmed wear defaults to reusable. Only explicitly selected laundryIds become laundry; wear history stays separate from cleanliness. Planning and skipping do not change availability. Wear records deduplicate garments on the same date and preserve historical IDs after garment deletion. Deleted garments are removed from saved outfit references. An incomplete saved look may remain after deletion; the builder never fabricates replacements.

Outfits contain typed role/garment references, occasion, explanation, planned date, confirmation timestamp and owner. Occasion sharing copies only selected garment display attributes into snapshots; it does not change the source garments' privacy. A reshared own look preserves existing votes/comments. Old snapshots remain when source garments or friendships are removed; participants were explicitly granted that snapshot.

Firestore:

- `users/{uid}`: private profile/preferences, onboarding, notification preferences, revision, skipped dates.
- `users/{uid}/{garments|essentials|outfits|wears|watches|searches|notifications|products}/{id}`: owner-only records.
- `profiles/{uid}`: signed-in directory, restricted to ID/displayName/username/photo. Private preferences never appear here.
- `friendRequests/{canonicalPairId}`: sender/recipient only; only recipient can accept/reject. Friendship creation requires an accepted request in the same transaction.
- `friendships/{canonicalPairId}`: two members. Being friends never grants full wardrobe access.
- `sharedGarments/{garmentId}`: explicit owner projection + allowed friend IDs. Reads require both list inclusion and continuing friendship. Load once per accepted friend to avoid unauthorized stale-share queries. Index: ownerId ASC + friendIds ARRAY_CONTAINS.
- `occasions/{id}`: host metadata, participant IDs/status, date/time/type/dress code/theme. Membership gates reads.
- `occasions/{id}/submissions/{authorUid}`: intentionally shared outfit display snapshots. Only author writes their body.
- Submission `votes/{uid}` and `comments/{id}`: participant-only, actor-scoped records. No impersonation or overwriting another person's vote/comment.

Security is enforced by `firestore.rules` and `storage.rules`, not client filtering. Parent occasion deletion immediately blocks subcollection access; old subcollection cleanup remains deferred; owned garment thumbnail deletion is implemented. Supabase thumbnail objects are private at users/{uid}/garments/{garmentId}/thumbnail.jpg. The backend verifies Firebase identity and Firestore ownership or explicit sharing before signing a URL for 300 seconds. Signed URLs are bearer links during their short lifetime; never log/store them as permanent public URLs. No Supabase privileged key reaches the app. Legacy Firebase Storage rules remain deny-by-owner restrictive but that storage adapter is unused.

## E. Development commands

Run from repository root. Commands exercised during this implementation (see status for final counts):

```bash
npm install
npm run dev
npm run backend
npm run backend:dev
npm run start
npm run web
npm run ios
npm run demo
npm run typecheck
npm run typecheck:backend
npm run test:backend
npm run qa:security
npm run lint
npm run format
npm run format:check
npm test
npm run test:unit
npm run test:integration
npm run test:ui
npm run test:rules
npm run test:e2e
npx expo-doctor
npm run export
```

`npm run demo` only controls Metro's offline mode; choose Explore demo in the app. `npm run android` is available but Android runtime QA was not executed. SDK 58-compatible Expo Go is required. iOS requires Xcode/simulator. Web export is not a signed native binary. Java 17+ runs the pinned CLI 14 emulator; emulator cache is placed under ignored `.firebase` because the machine's default cache directory is not user-writable. Playwright needs `npx playwright install chromium` once.

Optional cloud QA (not part of default tests, never send reset emails):

```bash
THREAD_RUN_LIVE_QA=1 node scripts/verify-cloud.cjs
THREAD_RUN_LIVE_QA=1 node scripts/verify-social-cloud.cjs
```

These target the dedicated project, create disposable `qa-…@example.test` accounts and remove their records. They require an authorized Firebase CLI login and local app on port 8081. Guard cleanup so it cannot delete non-QA accounts. Do not use against unrelated projects.

Rules deployment: `npx firebase deploy --only firestore --project thread-hacktx-2026-rp`. Auth config deployment uses CLI 15.34.1: `npx --yes firebase-tools@15.34.1 deploy --only auth --project thread-hacktx-2026-rp`. Never enable paid infrastructure or billing without explicit approval. Firebase Storage deployment is unnecessary for the Supabase image workflow.

## F. Coding rules

Reuse architecture/components/theme; avoid duplicate feature implementations and unnecessary dependencies. Keep strong types; validate untrusted data; keep private keys on a trusted backend. Respect owner scope and explicit sharing. Never make cloud writes look successful when they failed. Include loading/error/retry/empty/offline states and bounded waits. Every enabled control needs an action; disable controls at count/selection bounds. Confirm destructive actions. Preserve accessible labels, readable text, keyboard handling and safe areas. Run targeted verification and update docs. Phase 2 live calls are permitted only behind the authenticated backend. Tests default to fixtures; live smoke tests require THREAD_RUN_LIVE_QA=1. No Jester features in this application phase.

## G. Testing and self-verification protocol

Every future coding agent must: (1) understand affected behavior; (2) identify existing tests; (3) implement; (4) run TypeScript/lint/format checks; (5) run relevant tests; (6) fix failures; (7) inspect affected UI when tooling permits; (8) check related regressions; (9) update status/docs; (10) report exact remaining limitations. The user should not need to report routine spacing problems, obvious broken buttons, or straightforward TypeScript errors. Never claim an unexecuted test or uninspected screen passed.

Browser tests cover A–G plus offline demo. Component tests cover forms, filters, loading and empty actions. Emulator tests assert actual authorization denials, including guessed private IDs, revocation, forged owners, outsiders, votes and Storage MIME/owner restrictions. Expected permission-denied logs in those tests are intentional. Cloud QA is explicitly separate from deterministic tests.

## H. CAMERA TESTING RESTRICTION — preserve across sessions

**“Do not conduct automated physical camera-capture testing. The user will manually verify camera functionality.”**

Never activate physical camera hardware, capture a real photograph automatically, or claim a simulator verifies hardware capture. The user explicitly authorized simulator-only permission/UI checks and controlled gallery/photo-fixture E2E in section R. Physical camera capture remains user-only. Camera code must remain enabled. Capture is **Manual verification required**. Follow docs/MANUAL_QA.md; only the user may change this restriction.

## I. Phase 2 integration boundaries

See docs/PHASE_2_INTEGRATION.md for implemented routes and provider details. `src/services/backend.ts` implements existing interfaces and `services/index.ts` selects live adapters for Firebase accounts. Keep the offline mocks. `server/providers/meta.ts` uses **muse-spark-1.2 Standard** at https://api.meta.ai/v1. Account model-list verification found 1.2 available and live image/outfit calls succeeded. Contributor model names are rejected in config. Central META_MODEL and output limits must remain configurable. Structured responses validate with Zod; outfits use enum-constrained actual owned IDs, then independent category/availability/ownership checks. Group calls fetch only explicitly shared occasion snapshots.

`server/providers/serp.ts` uses google_shopping, google_lens (no discontinued type=products parameter), optional google_immersive_product merchant enrichment. Missing values remain null. No invented discount/exact match/compatibility claims. US USD comparisons only; unsupported currencies are excluded. Price watches refresh manually and store actual observations; no background scheduler exists.

Cache: hashed private disk cache, in-flight dedup, Meta image/prompt cache, 30-minute search cache, hourly merchant cache, conservative daily caps and per-user request limits. No generic automatic provider retries; vision alone has one bounded essential-field recovery on output truncation (section Q). Original inference images are processed in memory and discarded; Lens receives only an explicitly requested temporary signed image, removed afterward. Do not log bodies, keys or image URLs. Observed provider token usage is tracked; promotional balances are unknown.

## J. Environment variables

Public client config (not private API credentials): `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, legacy `EXPO_PUBLIC_FIREBASE_STORAGE_ENABLED` is unused; thumbnails now use Supabase.

Backend-only credentials: MODEL_API_KEY, SERPAPI_API_KEY, SUPABASE_URL, **SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY**, SUPABASE_STORAGE_BUCKET=hackTx. Configuration: META_MODEL=muse-spark-1.2, META_API_BASE_URL=https://api.meta.ai/v1, META_MAX_OUTPUT_TOKENS=2400, META_REASONING_EFFORT=minimal, PROVIDER_TIMEOUT_MS, MAX_META_CALLS_PER_DAY, MAX_SERP_CALLS_PER_DAY, PORT, ALLOWED_WEB_ORIGINS. Public EXPO_PUBLIC_API_URL is an optional LAN/HTTPS backend address, never a credential. `npm run dev` derives the LAN host and starts both services. Native localhost points to the phone, not the computer.

Never prefix privileged keys with EXPO_PUBLIC_, include them in a bundle, log them or commit environment files. `.env` and `.env.*` are ignored except tracked placeholder-only `.env.example`. `npm run qa:security` checks names, Git index/history and current secret matches without printing values. No prior secret match was found. No account/bucket/billing/Contributor changes were made in Phase 2. The configured Supabase URL is normalized to its project origin (a pasted /rest/v1/ path previously caused 404).

## K. Known issues and limitations

- Firebase Storage is unnecessary: private existing Supabase hackTx storage replaces it without billing. The backend currently runs locally; physical Expo Go acceptance still requires the user’s device and reachable Wi-Fi/HTTPS endpoint.
- Manual/untested: physical camera and gallery; Android runtime; actual local reminder delivery; reset-email delivery; full accessibility audit; notched iPhone hardware.
- Initials avatars; no portrait upload UI. No production signed iOS/Android binary or store release.
- Conversation messages update in realtime; inbox memberships/profiles refresh on reload or Settings → Refresh. Public directory and wardrobe snapshots are sized for hackathon use; paginate for production scale. Usernames are format validated, not globally reserved/unique.
- Compressed web thumbnails use browser storage and its quota; native thumbnails use persistent app document storage. Originals are not retained indefinitely or deleted from the camera roll. Native device workflows still require manual QA.
- Old image files and deleted occasion subcollections need eventual server cleanup. Current rules prevent access after parent deletion.
- Dependency audit has unresolved upstream Expo/CLI advisories. Do not use `npm audit fix --force` to break SDK compatibility or replace Zod 3 inside SDK tooling with Zod 4 without checking APIs. Consult current implementation status for the final audited counts. The app's own schemas use patched Zod 4.

## L. Current implementation status

See **PHASE3_STATUS.md** first for current refinement work, then PHASE2_STATUS.md for the current milestone, live API ledger and resume commands. See docs/IMPLEMENTATION_STATUS.md for Phase 1 milestones, exact executed checks, screenshots, final cloud QA results and remaining external/device limitations. Keep both files accurate. Core demo functionality is implemented; final verification is recorded there, not inferred from scaffolding.

## M. Agent handoff instructions

1. Read this AGENTS.md.
2. Read current implementation status and Phase 2 notes.
3. Inspect the repository and tests.
4. Continue from the latest completed milestone.
5. Preserve completed work; do not rewrite it without a concrete reason.
6. Keep demo mode offline, resettable, private and deterministic.
7. Run verification before stopping; inspect UI when available.
8. Update documentation and report actual results/limitations. Never violate the camera restriction.

## N. Backend operation and smoke tests

Start `npm run backend` separately or `npm run dev` for backend + Expo LAN. `GET /health` is configuration status, not provider verification; `/v1/*` requires Authorization: Bearer <Firebase ID token>. Route inventory and device steps are in README and docs/PHASE_2_INTEGRATION.md.

Deterministic checks: `npm run typecheck`, `npm run typecheck:backend`, `npm run lint`, `npm test`, `npm run test:backend`, `npm run test:rules`, `npm run test:e2e`, `npm run qa:security`, `npm run qa:visual`, `npm run format:check`, `npx expo-doctor`, `npm run export`. Opt-in provider smoke: `THREAD_RUN_LIVE_QA=1 npm run test:live` (backend must already run). Opt-in full browser gallery flow: `THREAD_RUN_LIVE_QA=1 npx tsx scripts/verify-phase2-ui.cjs` (backend and Expo web must run). These consume a few provider calls; do not repeatedly run them for routine changes. They use synthetic fixtures and disposable qa-…@example.test accounts, then remove only their records/object. Cleanup requires existing Firebase CLI authentication. Never activate the physical camera in these tests.

## O. Phase 3 refinement architecture

Read PHASE3_STATUS.md for executed checks and live-call ledger. Phase 3 explicitly excludes all Jester features.

- Recognition: `features/recognition/review.ts` merges observations independently of edited fields. Custom names must never suppress primary-color/category recognition. `GarmentForm` previews immediately, guards response sequences, keeps failed inference for retry, cleans app-created temporary files and preserves the editable manual path. `GarmentReveal` animates the original image only, during actual work and with reduced-motion support. Demo mode cannot inspect arbitrary photographs; it returns unknown/manual attributes with an explicit label.
- `server/providers/meta.ts` requests garment-focused observations and normalized garment bounds; `providers/color.ts` samples only an inset of those bounds to flag strong saturated-color vs neutral-model disagreements. Never apply whole-image averages or fabricate numerical confidence. Unknown fit/material/brand is preferable to guesses. Cache keys include image bytes/model/prompt/schema, so changed recognition schemas invalidate prior cache entries.
- Reuse: `features/laundry/rules.ts` hydrates legacy counters from known history without changing existing availability. Defaults tee/shirt=1, trousers/shorts=2, jeans/hoodie/sweater=3, jacket/shoes/accessories=null (manual). Existing `availability` is the laundry state; do not introduce a duplicate state. `wearCount` counts recorded wears since the last clean; clean resets it. Explicit keep-reusable/dirty overrides remain available. Daily same-piece/date duplicates do not increment twice.
- Check-in starts with selected outfit pieces, adds the full closet only on explicit request, and dismisses directly to Closet. Outfit details allow deselection; build/Home wear actions go to the same review. Tabs have focused background pills and bold labels.
- Weather: authenticated backend `/v1/weather/cities` and `/v1/weather`; optional private Profile.weather city choice, no precise GPS permission, Open-Meteo free noncommercial hackathon API. 15-minute cache, observation timestamps; stale weather does not drive styling. Production commercial use requires a separate provider licensing decision, not automatic billing.
- Outfits default to top/bottom, with at most one useful clothing layer; accessories explicit, formal shoes permitted. Owned IDs/category/availability checks remain server-side and client-side. Weather and preference options live in the shared schemas; server obtains the actual wardrobe and city preference itself.
- Reminder scheduling is local, not push: stable `thread-daily` identifier, editable HH:MM default 08:30, explicit permission on settings opt-in, cancellation on disable/sign-out, device-local repeating trigger. `ReminderBridge` reconciles without prompting and routes matching-user notification taps to check-in. Real delivery still requires phone QA.
- Shopping: `/v1/shopping/feed` (`shared/feed.ts`, `server/providers/feed.ts`) plans up to six AI suggestions plus deterministic diversity, up to 24 distinct queries; 30-minute plan/search cache, in-flight dedup, server daily caps. Google Shopping currently ignores offset pagination (official docs), so incremental feed loading changes relevant queries rather than fetching duplicate pages. Complete My Wardrobe is a shopping feed; owned-clothing insights remain a separate Home entry. No manufactured discounts/exact-match/currency/compatibility fields. `ShoppingFeed` virtualizes results and preserves distinct IDs, watches and comparison.
- Social: global `styleGroups` member records and immutable selected-piece `sharedLooks` snapshots. Separate author-only comment/reaction subcollections. Direct shares require continued friendship; group shares require both explicit audience inclusion and current group membership. Never copy complete private wardrobes into posts. Backend `/v1/images/sign` accepts optional lookId and authorizes its selected piece using Firestore with the caller's token; private Supabase storage remains unchanged. New group/look queries have indexes in firestore.indexes.json. Existing occasions remain available in the seven-day planner and old routes.
- Seven-day planning preserves manual events and existing outfit records; repeated use on another day creates a saved copy so older plans are not overwritten. External calendar OAuth is intentionally optional/deferred.

Sources verified during implementation: [Expo SDK58 local-notification support](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/), [system photo-picker permissions](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [SerpApi Shopping pagination limitations](https://serpapi.com/google-shopping-api), [Open-Meteo usage terms](https://open-meteo.com/en/pricing), [geocoding](https://open-meteo.com/en/docs/geocoding-api). Keep cost/privacy restrictions and all prior camera instructions.

Phase 3 final handoff: docs/PHASE_3_QA.md contains exact test/live commands and phone acceptance. Current executed results are 52 app tests, 24 backend tests, 11 security tests, 14 browser journeys; 54 browser screenshots had no horizontal overflow/runtime errors. Live fixture core and two-account social/privacy workflows passed in separate runs. Current reasoning is minimal (configurable low alternative), output cap 2400, Standard muse-spark-1.2; minimal was live-tested after a 1600-token truncation. Phase 3 provider use: 9 Meta and 3 SerpApi calls; balances unknown. Physical camera/reminder delivery remain manual. Never interpret a subset QA report as a full-provider rerun.

## P. Latest user follow-up: launch choice, full live demo, large discovery, wash/delete

This section supersedes earlier statements that all demo services are mocked or that arbitrary demo photos must remain manual.

- Root launch always shows **Log in / Explore demo** prominently, even when a session was restored. A signed-in account can explicitly Continue. No automatic root-to-Home redirect. Returning from camera/library is not treated as a fresh launch.
- **Explore demo now uses real Meta recognition, grounded outfits, wardrobe analysis, live shopping/Lens and weather without signup.** `services/demoLive.ts` obtains a Firebase anonymous session in a separate named Firebase app `thread-demo`. The normal `[DEFAULT]` app/session is preserved. Native auth persistence is keyed by app name; never restore a single shared Auth singleton or use getApps()[0].
- Firebase anonymous authentication was enabled on the existing project via a scoped admin config PATCH; no billing or other providers changed. `THREAD_CONFIGURE_DEMO_AUTH=1 node scripts/configure-demo-auth.cjs` verifies/enables only this setting. Preserve anonymous auth if deploying provider configuration from legacy firebase.json.
- Demo wardrobe/wear/social state stays in the local demo repository. Before live outfit/feed/analysis calls, `syncDemoWardrobe` mirrors only text metadata into the anonymous user's private Firestore scope; image:null, no full photo retention, no public directory profile. Backend requests use that guest's verified token. Meta outfit IDs are independently grounded, then the returned owner alias is mapped back to local demo for saving. Demo social friends remain explicitly simulated. Thumbnail persistence remains local for demo; signed-in accounts retain private Supabase cloud sync.
- **Offline sample demo** is a separate explicit option. It has 120 fictional sample listings, no network requirement and no real recognition. Automated browser/demo screenshots must select this option to avoid spending credits. Never silently report failed live inference as a mock success.
- Discovery fixed the three-item bug: sample products sharing three retailer homepages were incorrectly collapsed by URL deduplication. Samples dedup by stable sample ID; live products dedup by provider product ID across merchants, with URL/ID fallback. Live feed fetches three distinct query groups per batch, with up to 24 queries / eight batches. It eagerly aims for 72 distinct initial results (up to three batches), then loads automatically near the end via scroll/end/momentum guards. It stops honestly when available groups are exhausted, not literally infinite.
- Pull-to-refresh and Refresh feed rotate query groups to expose a different selection. Each refresh round has a distinct client page cache key; backend query caching/dedup and provider budgets remain. Default Discover has no hidden budget cap; explicit price filters apply. Complete My Wardrobe still uses the profile budget. Mock listings remain clearly marked sample.
- Closet/Laundry **Washed** confirms a full wash: availability=available, wearCount=0, lastCleanedAt updated, essentials.clean=total. It retains clothes/photos/outfits/history. Selected wash uses the existing laundry command. Never interpret reset as deleting the wardrobe.
- Closet **Delete clothes** opens `/garment/manage`: select, wash or confirm bulk deletion. `garment.deleteMany` validates every owner before mutation, removes selected items from outfit references, deletes private share projections via the Firebase repository, and cleans local thumbnails. Existing single-garment delete remains available. Private synced thumbnails are removed through the existing authenticated backend before metadata deletion; partial cloud failures surface retryable errors.
- Follow-up checks: 56 app tests, 24 backend tests and 17 browser journeys passing; live guest red recognition/save/restart and grounded outfit passed. Separate feed-only live check passed a large initial selection and automatic append. Additional usage: 3 Meta / 9 SerpApi requests on UTC October 25, including one recognition run disrupted by development reload. Newly created QA guest accounts/projections were cleaned with anonymous-record/creation-time guards. Physical camera remains user-only.

## Q. Targeted refinement — latest implementation (October 24 evening)

This section supersedes earlier statements about social realtime support, Clearance batching, recognition response size, and auth redirects. Full progress and evidence: [docs/REFINEMENT_STATUS.md](docs/REFINEMENT_STATUS.md).

- **Recognition:** retain configured `muse-spark-1.2` Standard, `minimal` effort, output cap 2400. Official multimodal Chat Completions format is text + `image_url: {url: data:image/jpeg;base64,...}`; never put encoded image bytes in text. Mobile inference input stays at most 1024px; backend rotates/removes EXIF and creates a max-768px JPEG 75; normal retained thumbnail remains 256px. No wardrobe history accompanies recognition. The model returns bounded visual observations; names/search keywords and uncertain-field hints are enriched deterministically. Preserve silhouette/texture/season/occasion fields when observed; unknowns stay unknown. No fabricated confidence: enriched confidence is null. Region-based color corroboration remains.
- Empty responses previously bypassed finish_reason and usage accounting. `structured` now records usage before classifying truncation. A `length` finish allows exactly **one** five-field essential-vision recovery, with the **same model and cap**. No retry for rate limits/timeouts/context failures. Context-limit (400), payload-size (413) and completion truncation are distinct recoverable errors. Numeric confidence is never invented. Sanitized JSON `meta_request` diagnostics include operation/model, elapsed time, byte/character counts, finish reason, safe error code and returned token counts, never image bytes, prompts, URLs, credentials or user IDs. Do not restore the old instruction to simply raise the token cap.
- **Icons:** root preloads bundled Feather font with `useFonts(Feather.font)` before routes render; tab icon slots/pills have bounded dimensions. Every tab keeps its icon, label and selected tint/background. Web screenshots verify glyphs; phone rendering remains user verification.
- **Primary clothing groups:** `primaryCategories` / `categoryGroup` in models group detailed types into Tops, Bottoms, Shoes. Added tank-top, other-top, other-bottom. Existing category values, accessories, photos and history are preserved without destructive migration. Closet primary All excludes legacy accessories; More filters → Show legacy accessories reveals them. Details/direct routes, management and explicit chat picker retain accessories. Add/edit shows a main group and subtype. Outfit roles, laundry defaults and shopping requests support the new types.
- **Clothing preference:** optional private `Profile.preferences.clothingMode` = men/women, set during optional onboarding or Settings/profile. Existing profiles remain valid; Discover offers selection when absent. Mode influences shopping queries, model styling context and fit suggestions; freeform fits/queries remain available. Explicit gender/unisex search wording overrides the mode, never restrict owned clothes by gender. Mode participates in cache keys and persists through existing repositories.
- **Clearance:** first page requests one distinct query, not a three-query barrier; no AI planning and no eager 72-item bootstrap. Additional verified-sale batches load on scroll/Load more; up to 24 query pages, deduplicated. Cached client pages bypass demo projection sync; server searches remain cached/deduplicated. Normal Discover retains its large initial selection (three concurrent queries per batch, eager target 72, bounded max 3 bootstrap batches), incremental feed and refresh rotations. Skeletons show first loading, previous products stay during refresh. Compact Discover shortcuts preserve cheaper search, personalized feed, Clearance and watches. Measurements distinguish real live runs from controlled fixtures.
- **Conversation-first social:** `/social/group/[id]` and `/occasion/[id]` now open `ChatScreen`. Text, timestamp/sender bubbles, reply previews, visual outfit attachments, + menu (AI outfit / selected closet pieces / saved outfit), keyboard-aware composer, paged history. Existing group membership/manual occasions remain; event styling and prior submissions are under Conversation details → Styling & previous shared looks (`/occasion/styling?id=`). Existing shared looks/comments/reactions remain in Social’s archive. No records were deleted in this redesign.
- **Chat persistence:** `src/models/chat.ts`, `features/social/chatDomain.ts`, `repositories/chat.ts`. Real accounts use Firebase subcollections `styleGroups/{gid}/messages/{mid}` or `occasions/{oid}/messages/{mid}`. Server timestamp `sentAt`, newest 50 realtime listener, cursor-based older pages, immutable sender-scoped creates, stable message IDs and transaction dedup. Listeners clean up on unmount. Demo conversations are explicitly local/simulated in AsyncStorage `thread.chat.v1.demo.*`; Restore seeded demo clears only these demo keys. Conversations update live; inbox membership/profile changes still use explicit refresh. Do not claim presence, delivery receipts or push messaging.
- **Privacy:** Firestore rules enforce current group/occasion membership for every message read/create, author identity, bounded content and matching snapshots of actual owned garments. Guessed IDs, forged senders/images, edits and outsiders are denied. `/v1/images/sign` accepts optional `chat:{kind,id,messageId}` and uses the caller’s Firebase token to retrieve the authorized message; ownerId must match message author and garmentId must be attached. Only then is a short private Supabase URL issued. Friendship alone still never opens a closet/image. Group removal revokes new image URLs; already issued signed URLs last up to 5min. Parent deletion makes message children inaccessible; server lifecycle deletion remains deferred.
- **Sharing is never wearing:** `attachmentFromGarments` creates an explicit snapshot only; chat send never calls wear/laundry commands. AI-builder chat entry saves/shares without a wear action and dismisses directly to its conversation. Explicit wear confirmation elsewhere remains the only wear path. Sending/AI sharing use submission locks, stable retry IDs and visible errors.
- **Login:** root fresh launch continues offering login/demo. After submitting valid credentials, AuthScreen now goes directly to Home or onboarding based on the loaded profile; it does not send users back to choose Continue again.

Verification commands: existing section E commands remain valid. Additional: `npx tsx scripts/benchmark-clearance.ts` uses synthetic provider latency only; `THREAD_RUN_LIVE_QA=1 npx tsx server/refinement-live.ts` spends one recognition call (one extra only if truncated); `THREAD_RUN_LIVE_QA=1 npx tsx server/clearance-live.ts` uses one initial search and a cache replay; `THREAD_RUN_LIVE_QA=1 npx tsx server/social-live.ts` verifies disposable two-user realtime chat and private Supabase attachments without AI/search calls. Scripts clean only their own guarded QA users/documents/temporary thumbnail. Do not run paid checks for routine edits.

Security rules with chat support were emulator-tested and deployed to the existing Firebase project. No bucket, account provider, billing or privacy terms were changed in this refinement. **Do not conduct automated physical camera-capture testing. The user will manually verify camera functionality.** No Jester/comedy features.

Final refinement verification: app/backend TypeScript, lint and formatting PASS;61 app tests /9 suites,29 backend tests,14 rules tests and18 browser journeys PASS. Web and iOS exports PASS;54 final browser screenshots captured without horizontal overflow/runtime errors, representative small/large chats/inbox/Closet/Discover inspected. Post-export credential scans PASS. Real recognition endpoint and full live demo gallery/save/restart checks passed; live Clearance returned40 verified discounts in495ms (cached175ms); real two-user preference/chat/private-image/counter-invariance checks passed. Full evidence and limitations are in docs/REFINEMENT_STATUS.md. Camera remains user-only manual verification.

## R. Latest authorization — real photos and iPhone Simulator QA

The user now explicitly requests iPhone Simulator end-to-end testing, native keyboard/safe-area checks, importing the three newest AirDropped garment photos and real Meta recognition. This permits **simulator-only camera permission/UI checks**, superseding section H’s older broad permission-request prohibition for this simulator workflow. It does not authorize or verify physical camera capture. Physical hardware capture remains user-only.

Use only Downloads IMG_1638.JPG, IMG_1639.JPG and IMG_1640.JPG, visually verified as two shirts and black pants. Preserve originals and their metadata/bytes. Personal fixtures/results/screenshots stay in ignored `.private-cache` folders; never commit them. Use Standard Muse, bounded calls and private backend credentials. Record actual simulator evidence and results in docs/SIMULATOR_QA.md. No Jester features.

## S. Current product direction — SOCIAL FASHION PIVOT (supersedes inventory UX)

Thread is now **an AI-powered social fashion platform that connects your wardrobe, outfit inspiration, and real-time shopping.** Core journey: discover an outfit → recreate it with owned clothes → shop missing pieces → share fits. Read PIVOT_STATUS.md for the active milestone. Keep four tabs and Home launch behavior. Social redesign is now explicitly authorized; earlier instructions not to touch Social are superseded.

Remove laundry, availability, counters, essentials and daily-check-in UI/workflows/notifications. Preserve legacy stored fields, historical records and all garments/photos; do not destructively migrate or reset demo. Styling treats owned clothing as available regardless of legacy laundry state. Photo recognition/private thumbnails/auth/shopping/chats must remain working. New social posts never expose an entire closet: use selected public/friends-only snapshots, private image authorization, actor-scoped interactions. AI remix reuses structured post metadata; photo-only analysis is explicit and cached by post/image version. Only actual owned IDs may appear as owned remix items. SerpApi is used only on explicit shopping, not feed scroll. Text/voice additions require review before save. Demo posts must be labeled samples; do not publish personal QA images as fixtures. No Jester features. Physical camera remains user-only.

## T. Earlier social fashion pivot — section U supersedes navigation/theme/post creation

Read **PIVOT_STATUS.md** first for exact executed verification and remaining device tasks. Sections A/S/T supersede older inventory feature inventories. Do not reintroduce laundry, wear confirmations, essentials, daily reminders, washed controls or availability blocking. Legacy records remain untouched. Old inventory routes are compatibility redirects to Closet; inactive domain helpers/tests remain for historical data safety.

### Navigation and state

Home / Closet / Discover / Social remain the four tabs. Root explicitly offers login/demo and keeps Home landing. Home offers honest rule-based initial styling and explicit live Meta generation, actual pieces, save/share, compact existing weather and seven-day planning. Closet virtualizes the grid with All/Tops/Bottoms/Shoes and optional legacy accessories. Photo, text and voice entries lead to editable review. `GarmentFallback` renders category icon/name/color/fit for unphotographed clothing, including outfit collages; never synthesize “photos” of owned clothes.

Social has Feed / Messages / Profile. Routes: `social/post/new`, `[id]`, `remix?postId=`, `share?postId=`, `social/profile/[id]`; existing group/occasion chats remain. Saved outfit sharing opens post creation; feed post sharing selects a group or creates a two-person DM. Conversation membership never grants source-post visibility. Source posts are rechecked when opening a preview/image.

### Post repositories and privacy

`models/posts.ts`, `features/feed`, `repositories/posts.ts` contain typed post/detail/comment/remix schemas, privacy/grounding helpers, independent paginated Firebase/local adapters and presentation. Avoid adding the whole global feed to AppData.

- `posts/{id}`: owner, caption, public/friends visibility, immutable selected garment snapshots (max6), optional private compressed photo, outfit reference, timestamps, explicit sample flag. Photo-only posts need no closet records. Creator can edit caption/audience or delete. Public posts require sign-in; friends-only checks current friendship. Anonymous live-demo social is still local, not a fake public account.
- `posts/{id}/likes/{uid}` and `comments/{id}`: actor-scoped creates/deletes; parent visibility required. Comments and post creates use stable retry IDs; no duplicate wear or garment records.
- `users/{uid}/savedPosts/{postId}`: private bookmarks. `users/{uid}/cart/{productId}`: private actual product snapshots; AppData.cart defaults[] for old records. Cart add/remove uses the existing validated repository command pattern.
- Profile.bio is optional/public (max180); private style preferences stay in users/{uid}. Public profile photo is an avatar version marker; the private Supabase object is signed only through authenticated directory lookup. Local demo avatars remain local.
- ChatMessage.post is an optional `{id,title}` reference, not a copied private closet. Firestore validates sender membership and current source visibility; recipients independently reauthorize. Post/outfit sharing never calls wear/laundry commands.
- Firestore rules/indexes support public, own and per-friend paginated queries. Owner check and snapshot matching live in rules, not just UI. Friend removal revokes new reads/image URLs; prior signed bearer URLs expire within5min. No broad wardrobe permissions or public bucket changes.

`LocalPostRepository` persists demo posts/interactions separately in `thread.posts.v1.demo`; ten clearly fictional collage samples use **constant bundled seed art**, independent of deletions in the viewer’s closet. Do not use the user’s three personal QA photos as sample-post assets. Local demo’s actual user-created posts and thumbnails must survive restart. Do not reset the native demo: it contains the user’s three real saved garments.

### AI/remix and input pipeline

`server/fashion.ts`, `shared/social.ts`, `shared/clothing.ts`, `services/fashion` are the new integration boundary. All calls use existing authenticated Fastify/Meta infrastructure and Standard mode.

1. Read/authorize the post using caller-token Firestore access, before any image/cache lookup.
2. Structured selected pieces bypass vision. Photo-only posts use garment-focused Meta vision and a seven-day private cache keyed by post/image version. Ignore identity/background; default extraction excludes jewelry/belts/glasses/bags. Unknown brands are null; never infer exact identities.
3. `normalizeClothingObservation` reconciles literal contradictory nouns within the same main clothing group (button-up described as tee → shirt; explicit jeans described as trousers → jeans). It preserves unknown fits and never guesses colors/materials. A print depicting other clothes must not reclassify the garment.
4. Match with compact actual wardrobe metadata. The response is **one ordered selection per original piece**: garmentId is constrained to the actual owned-ID enum or null. Never let the model emit invented sentinel IDs such as “missing” or contradictory matches/missing branches. Derive branches in code, then independently check ownership/existence/category/unique IDs and complete source coverage. Jackets cannot become unrelated tees. Legacy availability is ignored.
5. Save/share the actual matched garments. Missing-piece shopping passes query/group/postId into unified Discover. No AI or Serp call on feed scroll; only explicit remix/shopping actions.

Text extraction uses `/v1/wardrobe/extract`, bounded descriptions and editable selected lists. Atomic `garment.bulk` has stable reviewed IDs and idempotent retries; it must not change preexisting records on a partial failure. Offline demo has an explicitly rule-based literal parser; no fake live inference.

Voice uses SDK58 `expo-audio` AudioStream, user-initiated microphone permission only, mono PCM16 WAV,30sec cap, persistent draft transcript review. Backend validates WAV chunks/size/duration and resamples actual16/24/44.1/48kHz to24kHz, then calls official **POST /v1/asr/transcribe** with multipart `request` JSON + `audio` WAV, not OpenAI’s audio endpoint. `META_ASR_MODEL=muse-voice-transcribe-1.0` is central/server-only and was found in the account’s model catalog. Standard/no Contributor. Official published rate was$0.18/audio hour when verified; never invent remaining credits. Meter observed audio seconds and requests; cache/deduplicate unchanged recordings. Delete only app-created temporary audio after transcription. Never automatically record the user’s conversations. Synthetic speech fixture passed live transcription; physical microphone capture still needs user QA.

### Images and APIs

Existing garment thumbnail pipeline remains1024px mobile inference → max768px backend inference →256px retained thumbnail. New social photos retain compressed max768px display images, not originals. Real accounts upload into private `hackTx/users/{uid}/posts/{postId}/{version}.jpg`; local demo keeps app-document/data-URI copies. Server signs selected post garment images only after checking the authorized snapshot. Post signing retries once on expired/broken URLs; missing source images use a clear fallback. Deleting a post never deletes camera-roll originals or owned garments. Previously shared garment thumbnails can become unavailable if the owner deletes that source garment; fallback is intentional and does not expose another object.

New endpoints (all Firebase authenticated):

- POST `/v1/wardrobe/extract`, `/v1/wardrobe/transcribe`
- POST `/v1/ai/remix`
- POST/DELETE `/v1/posts/image`; POST `/v1/posts/image/sign`
- POST `/v1/profile/photo`, `/v1/profile/photo/sign`
- POST `/v1/shopping/cart-suggestions`

Do not import any server module into the mobile bundle. Existing AI/shopping interfaces and private Supabase credentials remain unchanged. No Meta/Supa/Serp secret uses EXPO_PUBLIC_. `.env.example` adds only the nonsecret ASR model default.

### Unified shopping and mobile quality

Discover combines search, All/On Sale, three main groups, compact price/brand/advanced filters, watches, comparison and shopping collection. Dedicated cheaper/clearance shortcut menus are removed; underlying adapters/routes remain compatible. Collection-match suggestions use Meta reasoning over actual saved product metadata (not claimed ownership) plus actual closet metadata, then contextual SerpApi search.

The first live feed batch is one search for fast first paint; later batches run up to3 independent relevant queries concurrently and interleave categories within each appended batch without moving prior rows. Cache/dedup, refresh rotations, honest timestamps/end states and a bounded24-query plan conserve credits. Explicit post searches use distinct contextual query variants, not the same query repeated under unrelated categories. Real listing category comes from its title, **never from a requested filter**; relevance favors explicit requested words/colors without invented percentages. Verified sales require a real original price greater than current. Missing fields remain unknown. Men is the default for new/legacy unset profiles; Women/explicit query choices are preserved. Existing cart/watches inform subsequent feed planning; adding a product does not trigger a new search on each render.

`Screen` uses iOS native keyboard insets for scrolling forms plus measured focus reveal; non-scroll chat keeps KeyboardAvoidingView. Multiline Field offers an explicit Done action while focused; interactive dismissal is supported. Chat attachment/details actions dismiss keyboard while preserving drafts. Icons preload bundled Feather font and active pills remain visible. Chips have no flex growth so they cannot expand into tall pills inside virtualized screens. Respect reduced motion and actual photo appearance.

### Verification and handoff

Run section E commands; `qa:visual` now captures the current product screens into ignored `.private-cache/pivot-visual`, always in offline demo. New tests cover retired-state independence, bulk input, post privacy/persistence, grounded remix, missing categories, cart/category interleaving, voice WAV/caching and real source authorization. Security emulator cases include private posts, foreign snapshots, public signed URLs rejected and post-chat access boundaries.

Real-photo sources/live reproduction are in docs/OUTFIT_PHOTO_QA.md. `THREAD_RUN_LIVE_QA=1 npx tsx server/pivot-live.ts` uses licensed stock photos, synthetic speech and disposable accounts. `THREAD_PIVOT_PHOTO_RETEST=1` skips repeated text/voice smoke tests. Do not consume credits for ordinary tests. Reports must distinguish failed semantic attempts, cache hits, fixture tests, live providers, simulator actions and physical capture.

Read PIVOT_STATUS.md before resuming. Preserve all working features and uncommitted user changes; continue from current work rather than rewriting. Update status/docs and inspect affected screens after changes. Physical camera capture and microphone capture remain user verification tasks; simulator/gallery testing is not hardware verification. No Jester features.

Final pivot verification (October24,2026):75 app tests /11suites,37backend tests,17rules tests,13browser journeys; frontend/backend type checks, lint/format,20/20Expo Doctor, web/iOS JS exports and post-export secret scans PASS.47browser screenshot checks had no overflow/runtime errors; representative screens inspected. Native iPhone17Pro/iOS26.4 covered photo-only posting, real Meta remix, save/share/chat, keyboard/Done, voice entry without recording and159cached real shopping results. Final restart retained21garments, two own demo posts/photo hash, saved remix and chat reference without wear mutations. Details and observed12Meta/6Serp pivot requests are in PIVOT_STATUS.md. Keep native demo data; physical camera and microphone still require user verification.

## U. Active social-first photography design — supersedes earlier conflicting sections

Read **SOCIAL_FIRST_STATUS.md** for the current milestone, actual tests and device limits. The app is now photography-first and dark forest green. No Jester. No illustrated/animated/AI-generated fashion assets may be introduced. Keep standard UI icons and typographic app mark; clothes without photos use honest text/color/icon cards, never invented product imagery.

### Navigation and UI

Visible tabs: **Feed / Closet / Discover / Profile**, in that order. `unstable_settings.initialRouteName=feed`; SDK58 Tabs does not accept the removed initialRouteName prop directly. New/signed-out users see welcome/login/demo. Returning authenticated/onboarded sessions redirect from `/` to Feed. Legacy `/home` and `/social` are safe redirects, not extra tabs. Auth/onboarding and back fallbacks target Feed.

Feed has Create post and Messages icons, independent virtualized post pages, and a floating **Style Me** button. Generator is `/outfit/style`; advanced options remain `/outfit/build`. Preserve occasion, Meta generation, Try another, save/share and actual garment links. Profile hosts identity/bio/photo, own/saved posts, saved outfits, friends, Settings and seven-day planner. Existing realtime conversations are under `/social/messages`, then their unchanged private group/occasion routes. Shopping’s Back to inspiration dismisses to its source post instead of stacking redundant screens.

Theme is centralized: background#0B0D0C, surface#171B18, primary#228B5A, active#34A875, text#F5F5F5/#A9B0AB. Button foreground uses onAccent, not surface. Danger has a darker action background and readable error text. System typography replaces the previous editorial serif. Status bar/native keyboards are light-on-dark. Toast is a non-intercepting dark View, not a touch-blocking Pressable.

### Real photography and non-destructive demo refresh

`assets/photography` has26 static JPEG assets from25 licensed source photographs.18 garment keys retain their old URI IDs so old demo records/saved looks/products/chats resolve to new real photographs without rewriting wardrobe data. Catalog substitutes are explicitly representative, with exact shade/fit/brand caveats; actual user camera/library paths always win.12 fictional sample posts use real fashion photographs, spanning casual, tailoring, layered, summer and statement styles. `mocks/fashionPosts.ts` contains curated observed metadata, never claims that a stock subject is an actual app user. `LocalPostRepository.read` refreshes ONLY recognized sample records, preserves real posts/interactions, and adds missing canonical samples. Never reset the native demo or replace user-uploaded photographs.

Provenance/license links: `assets/photography/sources.json`, `assets/LICENSE.md`, Settings → Photography credits. Pexels app use/cropping permitted; no endorsement implied. `scripts/fetch-fashion-photos.cjs` downloads approved photos locally; `scripts/crop-fashion-photos.cjs` makes garment-focused, color-preserving derivatives. Visually inspect after changing sources. Crop originals under ignored .private-cache are app-created copies, never personal files. Retired drawings/Expo template imagery moved outside active assets; do not restore generate-assets’ old implementation. Test-only synthetic color fixtures are not displayed app assets. Garment/outfit/chat collages now contain real photos, no cartoon cutouts or generated garment images.

### Post types and shopping handoff

FashionPost.kind is optional `outfit | clothing`; absent means legacy outfit. This preserves old records. **New post creation requires an uploaded real photograph**; optional selected saved-outfit metadata accelerates future remix. Photo + type + optional caption + visibility + preview + publish remains one screen. Link saved outfit is disabled during image processing to avoid an async image-layout/click race; wait for actual preview/readiness in UI tests. Legacy collage posts can still be read and explicitly labeled. Clothing cards use Find Similar; outfit cards use Remix With My Closet and Shop This Look. Sharing posts never records wearing or modifies wardrobes.

New authenticated POST `/v1/posts/analyze` reuses authorized structured metadata or cached per-photo Meta analysis and returns original garment observations without a matching call. It shares authorization/cache implementation with Remix. Clothing prompts ask for the main garment/shoes, ignoring hangers/background; unknown fit and null unknown brands remain valid. `find-similar` opens Discover directly for one clothing piece or offers a compact piece selector for an outfit, carrying query/group/source post. Products are similar-style SerpApi listings; exact identity is never assumed. Existing Lens adapter remains available separately. No provider calls on feed scroll.

Rules accept only optional outfit/clothing kind, require a private photo on new create, preserve owner-snapshot matching and actor/current-friend/source-post access controls. Existing public/friends visibility and Supabase private hackTx signing remain. Emulator tests passed and rules deployed to the existing Firebase project. No bucket/account/billing changes.

### Outfit refresh and occasion rules

`shared/styling.ts` provides occasionDirection/occasionScore for casual, campus comfort, dinner, date, expressive party and formal contexts. Both deterministic and Meta paths rank actual garments with this context. Meta receives only permitted role choices. Style Me submits currently displayed items; a full alternative request excludes the current top (or bottom when only the top is fixed) if a suitable alternative exists. Explicit replace-role preserves the other selected roles. IDs/category/ownership/duplicates remain independently validated. Legacy laundry fields never block styling.

UI commits successful results immediately, keys the collage by outfit ID, guards asynchronous results by request version when occasion changes and locks duplicate submissions. Try another preserves occasion; switching occasion resets variation/result. Limited wardrobes show honest alternative limits. Grounded explanation text uses the actual selected garment names and occasion; do not display model prose describing an old/excluded piece as the new outfit. Live native QA confirmed immediate casual changes and distinct dinner styling; fixture tests cover all five casual/classes/dinner/date/party choices.

### Verification and resume

Exact results/evidence are in SOCIAL_FIRST_STATUS.md.77app tests,41backend fixture tests,17rules tests and14browser journeys passed; frontend/backend TS, lint, formatting, web/iOS exports and secret scans are required after changes.49browser screenshots captured; representative screens inspected. Actual iPhone17Pro/iOS26.4 native QA covered default Feed, four tabs/icons, floating styling, real Meta changes, real clothing photo publish/recognition/Serp handoff, Profile/planner, Messages, dark keyboard and safe areas. The test-only clothing post is clearly labeled; all21garments, original3photo IDs/thumb hashes, previous posts and chat history are preserved. No physical camera/microphone capture was tested. Never claim otherwise.

Continue with `npm run dev`; backend3001 + Expo8081 must be reachable from the phone. Use SDK58 Expo Go. Do not rerun credit-consuming provider checks for routine edits. Keep privileged keys backend-only and .env variants ignored. Preserve all existing user/uncommitted work; no rebuild or destructive migration.

## V. DripGram final polish — active October25,2026

The visible product name is **DripGram**. Internal Expo slug/bundle IDs, Firebase identities and `thread.*` persistence keys deliberately remain stable. Read the final-polish section of SOCIAL_FIRST_STATUS.md first. No rebuild or Jester features.

- Shared dark UI uses compact 44px default touch targets, optional 34px visual pills with hit slop, 25px screen headings,16px gutters and consistent8/12/16px photo corners. Back headers stay fixed above scrolling forms/details so the keyboard cannot scroll navigation away. Preserve native focus reveal, safe-area insets, chat KeyboardAvoidingView and non-intercepting toasts.
- Feed cards are flat, divided posts: compact photo avatar/handle, actual image, interaction icons, caption/comments and small Remix/Shop actions. No Start a Conversation button. Comment navigation passes `comment=1` and focuses the existing detail input; the detail's own comment icon never pushes another post. No paid calls on feed scroll.
- Profile/creator profiles use the same paginated PostFeed with `grid` enabled:3 square thumbnails per typical phone row; actual photos/collages retain source context. Own identity defaults to Rishi Nigam/@rishi; only the exact old demo display name is migrated. No auth ID changes. Existing custom names and portraits win. Stats are actual friend/saved-outfit counts, not invented followers.
- Discover has one compact search row with collection/watches, an On Sale pill and compact expandable advanced filters. Products appear immediately below status/filters; comparison/cart/watches/pagination remain. Product photographs use disk/memory caching and consistent rounded corners.
- **Build a Look is constrained; generic Style Me is unconstrained.** Garment details pass `requiredGarmentId` and `origin=closet`. `shared/requiredGarment.ts`, client Zod contracts, mock engine and Meta server adapter carry/validate it. Server narrows the required role's ID choices and independently rejects an omitted/foreign piece. Required shoes bypass accessory defaults; required layers require compatible base tops; retries/regeneration preserve the piece. Never silently drop an incompatible required item. Extra styling controls are optional, not a long mandatory form.
- Saving a completed builder dismisses to Closet (anchored) or Feed (generic). Style Me save dismisses Feed; share replaces the generator with post creation. Remix save dismisses its original post; shopping replaces the intermediate selector/remix. Seven-day planning dismisses back to its planner. Keep origin semantics and actual Back history; do not blindly replace all pushes.
- Shopping instrumentation: numeric-only `Server-Timing` covers auth, four concurrent Firestore context reads, planning, provider latency/call count, normalization, merge, retention,total. `services/performance.ts` keeps a bounded local buffer of token/HTTP/decode/results/React commit/next-frame/image timings, without body/query/UID/image URLs. No diagnostics belong in normal product UI. Serp cache stores **unfiltered normalized provider rows by normalized actual outbound query**; price/sale/sort changes re-filter locally without another search and preserve original checkedAt. Namespace raw-v2 intentionally avoids reusing old already-filtered records. First page still1search, later up to3 independent searches; dedup and24-query bounds remain. The configurable default local Serp daily safety cap is80 (was60 and reached during QA), not an asserted credit balance. No billing change.
- Demo photography:5 additional licensed Pexels photos provide simple tees/hoodies/denim/cargos plus matching blue/red tee representatives;3 portrait crops support explicitly fictional sample accounts. Provenance is in assets/photography/sources.json and assets/LICENSE.md. `scripts/polish-demo-photos.cjs` is reproducible. Existing complex sample looks were replaced with simple observed combinations, preserving sample IDs.
- Exact local-demo QA photo replacements are narrowly scoped in `mocks/demoRefresh.ts`:3 known garment IDs **and matching creation timestamps**, and1 known QA post ID+caption. Archive originals to `thread.demo.photo-archive.v1` / `thread.posts.photo-archive.v1` **before** applying substitute representative photos. Never remove original app-document or camera-roll files. Never apply this migration to Firebase records or unrelated/new demo uploads. Do not broaden the predicates. Native preservation checkers inspect archives plus current records so original bytes are still verified. The primary demo avatar is a shoe photograph; do not claim a stock portrait is Rishi.

Verification commands remain section E. Optional `THREAD_RUN_LIVE_QA=1 npx tsx server/polish-live.ts baseline` / `after` are deliberate provider tests using a disposable account; most tests use fixtures. `after` cleans up the disposable account. Never expose the ignored account-state file. Exact measurements and native screenshots are in SOCIAL_FIRST_STATUS.md; performance varies with provider/network cache state. Physical camera/microphone remain user-only verification.

Final polish results:88app tests/13suites,47backend fixtures,17security rules and17browser journeys passed. TS/lint/format,20/20Doctor, web+iOS JS exports and secret scans passed. Native iPhone17Pro/iOS26.4 tested real mandatory-sneakers Meta generation, direct completion return,158real shopping products, Profile grid, comments/chat keyboard and restart persistence. Original demo-photo archives and host originals were verified. See SOCIAL_FIRST_STATUS.md for exact timings,4Meta/7Serp observations, screenshots and physical-device limits. No known regression remains in the tested journeys; do not imply perfect recognition or verified physical capture.

## W. Active final UX + responsive web release (October25,2026)

This section supersedes earlier screen sizing, shopping-return, feedback and hosting limitations. Read **SOCIAL_FIRST_STATUS.md** and **docs/WEB_DEPLOYMENT.md** before continuing. Preserve all real/local demo data and the user's uncommitted tree. No Jester; physical camera/microphone remain user-only.

### Compact styling and feedback

Feed has only the comment icon, which opens/focuses the existing comment UI; no duplicate Add/View Comment or Start Conversation button. Style Me has compact bookmark/share icons, occasion selection, Generate With Meta and small Try Another. No More Styling Options action. Bookmark toggles in place and does not regenerate the displayed look; the rule-based result depends on stable garment metadata rather than unrelated AppData writes.

`OutfitFeedbackSchema` / `AppData.outfitFeedback.default([])` and command `outfit.feedback` store **preference feedback only**. Fields: id=outfitId, ownerId, actual owned garmentIds, occasionType, response=wore|did-not-wear, createdAt/updatedAt. One stable record per user/outfit; repeated same response is a no-op; changing keeps original createdAt; null undoes. The outfit need not be bookmarked first. `OutfitFeedbackButtons` appears in generator and saved details. No wear/laundry/availability/inventory writes or recommendation-learning algorithm. Firestore `users/{uid}/outfitFeedback/{outfitId}` has separate strict owner/owned-ID/shape rules (not a generic wildcard bypass). Rules are deployed; emulator and real disposable Firebase create/change/undo/no-inventory tests passed. Legacy profiles default to an empty list without migration/reset.

### Wardrobe-aware Shop the Look

`features/shopping/lookAnalysis.ts` checks post authorization before cache lookup; keys include actor/mode/post/image version, bounded30min cache/inflight dedup. `lookComparison.ts` compares actual owned category roles, approximate color families and known patterns, never counts one owned piece twice. It distinguishes category gaps/color differences/unknowns and prioritizes a genuine missing core category. Claims are approximate, not exact matches or invented confidence. Per-piece Find Similar remains available even for an owned equivalent.

`/social/post/find-similar?postId=` remains mounted while `/social/post/shop-results` is pushed. The latter reuses the **same ShoppingFeed** and service as Discover, with query/group/source post and selected-piece context. Native Back pops to the retained breakdown; repeated piece searches do not stack redundant pages or repeat Meta analysis. Independent Discover has its own clean state. Do not replace the breakdown with a bottom-tab redirect or add redundant Back to Inspiration inside this back-enabled results route. Bundled photo-only analysis resolves the actual Expo asset URI before encoding, not a demo lookup key as though it were a URL.

### Discover reload-loop fix

`ShoppingFeed` uses `useIsFocused` from **expo-router** (SDK58 vendored navigation; do not import an absent @react-navigation/native). Hidden tabs do not fetch; completed populated keys survive tab returns. Append requires actual first-page products, a positive cursor, focus and no pending/error/failure latch. Failed first loads cannot cause repeated onEndReached searches. Explicit Retry/Refresh clears the error; failed refresh retains previous products. Component regressions cover all these cases. The local daily Serp guard was reached during development; configured .env MAX_SERP_CALLS_PER_DAY is now200, bounded within the user's allocated credits, not an asserted balance or paid-plan change. Default code guard remains80. Respect cache/dedup and avoid query-on-render.

### Responsive web and persistent navigation

`theme/responsive.ts` centralizes max widths/gutters/grid sizing; root `DesktopInsetContext` accounts for the244px desktop sidebar. Discover2/3/4/5/6columns at375/768/1100/1280/1920px; Closet/Profile also expand, forms stay constrained. Desktop Feed uses a518px wrapper/470px photograph with browser-centered geometry and a separate compact actual-profile/friends panel. Mobile remains photo-first with its bottom tabs. No fake Stories/activity/counters.

**The root Stack owns DesktopSidebar**, preserving navigation across Messages/Create Post/Settings/conversations/details. Tabs only hide their bottom bar on desktop. Keep one sidebar, no duplicate shell. Sidebar rows have distinct Feather icons, actual Profile avatar and active tint. Firebase Hosting must upload `dist/assets/node_modules` (font/Router assets); the broad node_modules ignore caused square glyphs in production, fixed and covered by actual hosted-font loading QA. Do not restore that ignore. Photography and fonts must be visibly loaded before release screenshots, not inferred from HTTP200 SPA fallbacks.

### Hosting and verification

User chose laptop backend + public HTTPS tunnel. Public frontend: **https://thread-hacktx-2026-rp.web.app**; current backend origin in ignored `.private-cache/public-backend.json`. `dripgram.tech` binding exists, user added both DNS records and public DNS resolves; managed certificate validation is pending until independently checked. Exact records/status: docs/domain-setup.json. Auth authorized domains and exact CORS include the domain, existing entries preserved. No billing enabled. Keys remain server-only, private Supabase bucket hackTx unchanged.

Verified commands: `npm run host:backend` (reuses healthy existing process or starts backend/cloudflared), `npm run publish:web` (HTTPS health → export with public origin → credential scan → only Firebase Hosting). Quick Tunnel restarts change origin, requiring rebuild/redeploy. Keep laptop/backend/tunnel online; macOS caffeinate is scoped to the active tunnel. Do not claim permanent backend hosting. Read deployment runbook for domain/certificate status and restart details.

Current QA: app101tests, backend47, rules19; browser journey counts/results and responsive screenshots in SOCIAL_FIRST_STATUS.md. Actual iPhone17Pro/iOS26.4/ExpoGo58.0.7: compact save/change-feedback, shopping-return, Discover tab stability, hard-restart feedback persistence/undo passed. All21garments, original photo hashes/history/posts/messages remain; one QA saved outfit was added, no garments deleted. Public HTTPS smoke passed Firebase/Firestore, Meta Standard recognition/grounded outfit, SerpApi Shopping/Lens, private Supabase upload/sign/public denial and cleanup. Physical camera has not been manually verified. Do not imply it has.

### Public repository handoff

Public repository: https://github.com/w8asec7/dripgram, branch main. Git commits use the verified account's GitHub noreply address. The original local master history is preserved locally and was deliberately not pushed because its metadata contains a personal email. Public main begins from the complete reviewed source snapshot; future work should continue normally on main and push only that branch, never push all local refs by default. Do not rewrite/reset the preserved local master.

Public Git excludes .env variants, provider caches, runtime data, personal fixture manifests/photos and all private screenshot evidence. Licensed bundled photography and synthetic test-only fixtures remain. The staged source was compared against actual privileged environment values before publishing, with zero matches. The original template contained no committed API secrets. Read the deployment runbook for the already deployed frontend and intentionally laptop-hosted backend.
