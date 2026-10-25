# Phase 3 verification and phone acceptance

No Jester features. No physical camera test was attempted. Existing SDK 58, Firebase account, private Supabase **hackTx** bucket, and Standard `muse-spark-1.2` are retained.

## Automated checks

Run from the repository root:

```sh
npm run typecheck
npm run typecheck:backend
npm run lint
npm run format:check
npm test
npm run test:backend
npm run test:rules
npm run test:e2e
npm run qa:visual
npm run qa:security
npx expo-doctor
npx expo install --check
npm run export
npx expo export --platform ios --output-dir .private-cache/ios-export
```

Jest includes UI review of a red fixture with a pretyped custom name, migration/counter/selected-piece rules and mocked native reminder permissions, scheduling, deduplication and disabling. Backend tests cover real image preprocessing with synthetic fixtures, region/background distinction, output parsing, ownership/category grounding, cache/budgets, feed queries/dedup and city weather. Security emulators test actual authorization denials. Playwright covers original journeys plus selected-only confirmation, feed filters/watches, social groups/comments/reactions/comparisons, reminder preferences and dated outfit planning. Browser/gallery checks never click Take photo.

Visual captures are in docs/screenshots. They include welcome/auth/onboarding, Home, Closet, garment add/details/review actions, outfit build/details/check-in, products/search/clearance/feed, friends/groups/share/discussions, week planner, weather and reminder settings, with representative 320px and 430px variants. Captures check horizontal overflow and browser runtime errors. Screenshots were visually inspected; native typography/keyboard/notched-device behavior still requires device testing.

## Live checks actually executed

The authenticated application workflow successfully analyzed the synthetic red shirt, preserved an edited name, saved the garment, reloaded the app and retrieved its private synced thumbnail. White and charcoal/black fixtures were also correctly recognized in separate calls. These samples do not establish perfect recognition of real photos. A mislabeled earlier white fixture was actually cream and has been corrected.

Grounded simple Meta outfit generation passed. Personalized shopping returned 7 then 21 real listings from distinct queries; clearance returned 37 listings with actual original/current price evidence. Manual-city Open-Meteo geocoding and current weather passed. Fixture values are observations from those calls, not promised catalog sizes.

Firebase Auth/Firestore, Supabase private upload/signed retrieval/public denial, and live group selected-image access/outsider denial/unshared-piece denial passed. Two-account UI testing separately verified group creation, selected-piece sharing, feed retrieval, reactions, comments and reload persistence. Disposable QA records/objects were removed. A server-side check found zero remaining storage objects for inactive accounts without reading active users’ garment directories.

Reproduction commands (explicit opt-in; conserve credits):

```sh
# Backend + web preview must already run.
THREAD_RUN_LIVE_QA=1 npx tsx server/phase3-live.ts
# Only group image-authorization checks, no Meta/SerpApi requests:
THREAD_RUN_LIVE_QA=1 THREAD_PHASE3_ONLY=social npx tsx server/phase3-live.ts
# Cloud social UI with disposable accounts, no Meta/SerpApi requests:
THREAD_RUN_LIVE_QA=1 npx tsx server/social-live.ts
# Synthetic recognition response + real Firebase/Supabase persistence:
THREAD_RUN_LIVE_QA=1 npx tsx scripts/verify-save-fixture.cjs
```

The core live run passed its AI/shopping/weather/UI checks, then stopped on a test-fixture friend-request timestamp mismatch. That runner was corrected and its remaining social-authorization section passed separately; it was not rerun end-to-end merely to spend more credits. Early runs exposed a Meta output-limit failure; current minimal reasoning and 2400-token cap passed subsequent live core checks. No automatic provider retries are introduced. A subset runner report is docs/phase3-social-authorization-results.json; do not interpret it as a fresh AI test.

Phase 3 actual provider requests: **9 Meta, 3 SerpApi**, including debugging calls and one output-limit failure. Backend meter changed from 10/5 to 19/8. Reported token deltas were 5,330 input and 9,669 output; promotional balances are unknown. Weather made two provider requests. Do not rerun paid tests for formatting or ordinary UI work.

## Phone acceptance

1. Run `npm run dev`, or keep the currently running Expo/backend processes. Phone and computer must share reachable Wi-Fi. Open the printed Expo URL in Expo Go. The API host derives from Expo; never use phone localhost for the computer backend.
2. Sign in. In Closet, tap Add garment → Take photo. Grant camera permission only now. Photograph a clearly red garment against a neutral background. Check preview, category/color/name/fit, edit a field and save. If uncertain, correct the observation; no brand/material guess is required.
3. Kill/reopen Expo Go and verify the thumbnail and metadata persist. On another device, sign into the same account and check private thumbnail retrieval.
4. Generate a casual outfit. Expect two core pieces unless weather/layering calls for a third. Select Complete outfit only when shoes/accessories are wanted.
5. Deselect one piece, Wear Selected Items, and confirm. Only selected pieces increment. You should return directly to Closet. Verify hoodie/jeans reuse counts; mark clean or reusable to override.
6. Set a city in Settings → City weather. Verify observation timestamp, then disable personalization. No precise GPS prompt should appear.
7. Set a reminder a few minutes ahead and enable it. Allow notification permission, background the app and verify delivery/tap routing. Disable it and check that no duplicate reminder remains. Web preview does not deliver device notifications. Remote push is not configured.
8. Open Complete My Wardrobe/Clearance, scroll for more finds, apply a budget filter, save/compare, and open a genuine merchant link. Results are cached; fewer items are possible when filters are restrictive.
9. With a friend, create a group, share a selected outfit, comment/react and pull to refresh Social. Verify other private clothes never appear. Cloud social uses explicit refresh, not live listeners.
10. Review keyboard, touch targets, safe areas, scrolling and reduced-motion behavior on your actual phone. Share the screen/action and plain error message for any failure; do not send credentials.

**Camera capture has not been manually verified. User testing required.**

## Follow-up: real demo and wardrobe controls

Explore demo now uses real AI/live shopping without signup, through an isolated anonymous Firebase session. Offline sample demo is the explicit mock alternative. Existing deterministic tests and screenshot scripts choose Offline sample demo. Real guest fixture checks: `THREAD_RUN_LIVE_QA=1 npx tsx server/demo-live-check.ts`; feed-only: add `THREAD_DEMO_SMOKE=feed` to avoid repeating inference. Actual follow-up usage: 3 Meta and 9 SerpApi requests; guest QA accounts/projections cleaned. Recognition/save/restart/outfit passed, and automatic large-feed append passed separately. Local demo thumbnails remain local; real social friends/cloud thumbnail sync use signed-in accounts.

Manual checks: relaunch at the root and choose Log in / Explore demo; verify a real photograph in live demo; pull Discover to refresh into a different selection, scroll for more; Closet → Washed should reset counts/clean states without deleting clothes/history; Closet → Delete clothes → select → confirm should remove only chosen garments. Do not automate physical camera capture. Latest automated counts: 56 app, 24 backend, 17 browser tests passing.
