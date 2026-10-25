# Expo SDK 58 upgrade — verified

Completed October 24, 2026 at the user's request. The existing wardrobe application, Firebase authentication, private Firestore/Supabase data, backend integrations and offline demo were preserved. No physical camera was activated and no Meta or SerpApi requests were made for this migration.

## Runtime and dependency alignment

| Component                    | Previous      | Current                              |
| ---------------------------- | ------------- | ------------------------------------ |
| Expo                         | 55.0.32       | **58.0.19**                          |
| Expo Router                  | 55.0.18       | **58.0.26**                          |
| React / React DOM            | 19.2.0        | **19.3.0**                           |
| React Native                 | 0.83.10       | **0.88.0**                           |
| Reanimated / Worklets        | 4.2.1 / 0.7.4 | **4.7.1 / 0.13.0**                   |
| Gesture Handler              | 2.30          | **3.3.0**                            |
| TypeScript                   | 5.9           | **6.0.3**                            |
| Jest / jest-expo             | 29 / 55       | **30.5.2 / 58.0.12**                 |
| React Native Testing Library | 13.3.3        | **14.1.0**, with test-renderer 1.3.1 |

Expo's bundled compatibility map and `expo install --fix` aligned all native modules (including camera, image picker/manipulator, persistent filesystem, SecureStore, images and safe areas). Unused direct React Navigation packages were removed; Router supplies its navigation core. Firebase registry/security overrides were preserved. No force or legacy-peer-dependency flags were used.

Requires Node **22.13+ on the 22 line, 24.3+ on the 24 line, or 26+**; this machine uses Node 22.14.0. The package engine range records this. Upgrade passed through SDK 56.0.24 / RN 0.85.3 and SDK 57.0.31 / RN 0.86.3, with type checks at each step. Original package/lock snapshots are in ignored `.private-cache/sdk-upgrade`; no environment files were copied.

## Compatibility fixes

- Adopted React Native's stricter color/source types: tab icons use the configured string palette, bundled image types come from Expo Image, and no legacy deep-import opt-out was added.
- Declared Jest/Node/React globals explicitly for TypeScript 6.
- Replaced React Hook Form render-time `watch()` calls with subscribed `useWatch()` values. Garment submit work, including draft refs, is created in the event handler.
- Image state resets through a keyed image renderer; authorized thumbnail resolution remains asynchronous and refreshable.
- Async resources derive loading when a request changes, ignore superseded results and recover on retry. Two new tests cover races and recovery.
- Search forms initialize from route/reference data and remount for a changed route; no synchronous effect resets or automatic paid searches were added.
- Migrated UI tests to RNTL 14's awaited render/events and new Test Renderer; removed deprecated react-test-renderer. Updated Jest 30's `--testPathPatterns` flags.
- Used Reanimated's official Jest resolver plus `setUpTests`. Native font loading is mocked only in unit rendering; actual browser fonts and icons were visually checked.

## Web output decision

SDK 58's development server rendering threw unknown-module errors on repeated page loads in this project, despite successful exports. Clearing Metro and disabling async routes alone did not fix the server module registry. The browser preview now uses supported **single-page-app output** (`web.output: single`) and eager web routes (`expo-router` plugin `asyncRoutes.web=false`). All nine browser journeys, including full-page reload, deep-linked routes, gallery persistence and canceled photo replacement, then passed.

This app is an authenticated mobile client with a separate trusted backend; it does not require web server rendering. Native Expo Go behavior is unaffected. No node_modules patches or authorization changes were made. A future static host must rewrite app routes to `index.html`. Do not switch back to server/static prerender mode without retesting repeated deep-link/reload behavior.

## Actual verification

| Executed command / check                                              | Outcome                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| npm run typecheck                                                     | PASS                                                                                        |
| npm run typecheck:backend                                             | PASS                                                                                        |
| npm run lint                                                          | PASS, zero warnings                                                                         |
| npm test                                                              | PASS, **40 tests / 5 suites**                                                               |
| npm run test:unit / test:integration / test:ui                        | PASS; renamed Jest 30 flags verified                                                        |
| npm run test:backend                                                  | PASS, **19 tests**                                                                          |
| npm run test:rules                                                    | PASS, **9 emulator security tests**                                                         |
| npm run test:e2e                                                      | PASS, **9 browser journeys**                                                                |
| THREAD_RUN_LIVE_QA=1 node scripts/verify-cloud.cjs                    | PASS real signup/sign-in, Firestore CRUD and reload persistence; disposable account removed |
| npm run qa:visual                                                     | PASS, **34** captures; no horizontal overflow/runtime errors                                |
| npm run export                                                        | PASS, SPA web output                                                                        |
| npx expo export --platform ios --output-dir .private-cache/ios-export | PASS, native Hermes bundle                                                                  |
| npm run qa:security                                                   | PASS, no tracked/history/exported privileged-key matches                                    |
| npx expo install --check                                              | PASS, dependencies up to date                                                               |
| npx expo-doctor                                                       | PASS, **20/20**                                                                             |
| Expo Go manifest                                                      | HTTP 200, SDK **58.0.0**                                                                    |

Actually reviewed the new welcome, Home, Closet, add garment, outfit builder, Discover, clearance search and Social screenshots. Physical native UI, gallery/camera and device notification delivery are still manual. Simulator remained closed. Final formatting and Git whitespace checks are included in the handoff verification.

Dependency audit: **16** remaining upstream advisories (6 moderate / 10 high / 0 critical); omit-dev audit **5 high**. This is lower than the prior 19, but not a clean audit. No incompatible force upgrades were applied. Existing backend-only secrets and provider budgets remain unchanged; the Phase 2 live API ledger is preserved separately.

## Run / phone acceptance

```bash
npm install
npm run dev -- --clear
```

Use **SDK 58-compatible Expo Go**, same Wi-Fi as the computer. Fully close the old preview and open the current terminal QR/link. The backend URL is printed by the launcher; verify `/health` on the phone if needed. Follow `docs/MANUAL_QA.md` for photo → recognition → editable save → persistent thumbnail → outfit → shopping.

**Camera capture has not been manually verified. User testing required.** Never automate physical capture or camera permission prompts.

## Official references

- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/sdk-58
- https://docs.expo.dev/router/migrate/sdk-57-to-58/
- https://docs.expo.dev/router/web/async-routes/
- https://github.com/callstack/react-native-testing-library/blob/main/website/docs/14.x/docs/start/migration-v14.mdx
- https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/
