# Social fashion pivot — previous milestone

**Superseded for navigation/theme/post creation by [SOCIAL_FIRST_STATUS.md](SOCIAL_FIRST_STATUS.md).** Current tabs are Feed/Closet/Discover/Profile; returning sessions land on Feed. All active fashion imagery is real photography. The results below document the earlier milestone.

Completed October 24, 2026 (America/Chicago). Product: **An AI-powered social fashion platform that connects your wardrobe, outfit inspiration, and real-time shopping.**

Core journey: discover an outfit → remix with actual owned clothing → shop missing pieces → share fits.

## Preservation and product decisions

Existing SDK58 Expo app, Firebase authentication/Firestore, private Supabase **hackTx** bucket, Standard Muse vision and grounded outfits, live SerpApi and realtime chats were preserved. Extensive pre-existing uncommitted changes remain. Home stays the initial tab; fresh launch offers login/demo. No Jester functionality.

Laundry, wear counters, dirty/clean status, essentials, daily check-ins and inventory reminders are removed from active screens/workflows. Legacy records/history remain for compatibility; styling ignores old availability. Old management routes safely redirect to Closet. Do not reset native demo: it contains the user's three real garments and saved photo-only posts.

## Completed milestones

- [x] Simplified Home: actual owned looks, explicit Meta generation, save/share and seven-day planning.
- [x] Simplified virtualized Closet: All/Tops/Bottoms/Shoes, search, CRUD, bulk deletion and no-photo fallback cards.
- [x] Photo, reviewed bulk text and native voice input; no automatic save from transcription.
- [x] Feed/Messages/Profile with image-only or saved-outfit posts, captions/audience editing, deletion, likes, comments and private bookmarks.
- [x] Private compressed post/profile images, authenticated signing and public/friends-only post authorization.
- [x] Cached structured/photo Meta remix with actual owned IDs, honest substitutions and missing-piece Discover context.
- [x] Post previews shared into existing group chats or two-person DMs; sharing never changes wardrobe history.
- [x] Unified personalized shopping, sale/price/category/brand filters, mixed incremental results, product collection, watches and collection-match suggestions.
- [x] Native keyboard/safe-area fixes, restored tab icons, compact shopping header and reduced card clutter.
- [x] Automated checks, live provider tests, browser/native visual QA and documentation.

## Actual verification

| Command/check                                                                 | Result                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                           | PASS                                                                                  |
| `npm run typecheck:backend`                                                   | PASS                                                                                  |
| `npm run lint`                                                                | PASS                                                                                  |
| `npm run format:check`                                                        | PASS; final documentation formatting checked                                          |
| `npm test`                                                                    | PASS — 75 tests / 11 suites                                                           |
| `npm run test:backend`                                                        | PASS — 37 fixture tests                                                               |
| `npm run test:rules`                                                          | PASS — 17 Firestore/Storage authorization tests                                       |
| `npm run test:e2e`                                                            | PASS — 13 browser journeys                                                            |
| `npm run qa:visual`                                                           | PASS — 47 screenshots; no horizontal overflow or browser runtime errors               |
| `npx expo-doctor`                                                             | PASS — 20/20                                                                          |
| `npm run export`                                                              | PASS — web export                                                                     |
| `npx expo export --platform ios --output-dir .private-cache/pivot-ios-export` | PASS — iOS JavaScript/assets export, not a signed native build                        |
| `npm run qa:security`                                                         | PASS — ignored environment files; no tracked/history/export privileged-secret matches |

Fixture tests cover reviewed bulk creation/idempotency, post persistence/ownership, schema/category normalization, valid owned remix IDs, missing categories, legacy availability independence, WAV validation/cache/budgets, cart persistence and category interleaving. Rules tests cover foreign snapshots, private wardrobes/images, spoofed actors, removed friendships and chat/post visibility. Rules/indexes were deployed to the existing Firebase project after emulator verification. Most automated tests use synthetic provider fixtures and spend no credits.

### iPhone Simulator

**iPhone 17 Pro / iOS 26.4 / Xcode26.4 / official Expo Go58.0.7** launched successfully. Actual native screenshots and actions covered photo picker, garment analysis/review/save, Home/Closet/icons, ordinary-person photo-only posting, live photo/structured remix, saved remix, post-to-chat preview, message send, native keyboard, attachment menu and voice-entry UI without recording.

The three authorized AirDropped originals were recognized as burgundy T-shirt, light-blue printed T-shirt and black trousers; original bytes unchanged. Hard restart restored21 garments with the same persistent thumbnail hashes. Final restart also preserved two user-created demo posts, one85,772-byte photo with identical SHA256, saved remix and eight chat messages including a post reference. Before/after garment-ID and wear-history hashes matched. See `docs/SIMULATOR_QA.md`.

Native Discover displayed **159 actual cached retailer listings** with honest last-checked timestamp. Compacting its redundant header brought product images into the first viewport. Cached reopening did not increase provider counts. Native keyboard measurement: composer bottom506 / Send507 versus keyboard top539; attachment opening dismisses keyboard and keeps the draft. Multiline forms have a tested Done action. Simulator is left visibly on Home.

### Live APIs — actually tested

- **Firebase PASS:** real email/password sign-in, Firestore garment/post/message persistence, unrelated-user closet denial and actual cloud photo-post rendering.
- **Meta PASS:** `muse-spark-1.2`, Standard, minimal reasoning, bounded output. Two licensed ordinary-person photos were analyzed and remixed against actual closets. Pexels: white button-up + beige trousers; owned blue Oxford + sand trousers offered with explicit color substitution. Unsplash: white shirt + pale-pink wide trousers + black shoes; owned blue jeans substituted honestly, missing shirt/shoes identified. Fit remains an estimate, not calibrated confidence.
- **Meta voice/text PASS:** five reviewed garments extracted from a description; synthetic4.08-second speech transcribed using account-available `muse-voice-transcribe-1.0`, Standard. A repeated spoken item remained visible for review, never auto-saved. Physical microphone capture is untested.
- **SerpApi PASS:** real missing-piece queries returned25 products in the full run and39 in the final targeted retest; native long feed used four additional search requests. Results remain provider listings, not claims of exact garment identity.
- **Supabase PASS:** existing private hackTx bucket, authorized upload/sign/retrieval; public and unrelated-account access rejected. Only disposable QA objects/accounts/documents were cleaned.

See `docs/OUTFIT_PHOTO_QA.md` for licensed source links and actual outcomes. Live QA found and fixed an invalid model sentinel ID and contradictory category/subcategory observations. Final grounded selection uses actual-ID enum or null; matches/missing are derived in code and independently checked. No fixture-specific color hardcoding.

### Observed provider usage

During the pivot: **12 Meta requests and6 SerpApi requests**, including failed semantic attempts and one development-reload repeat. Voice usage observed approximately4seconds. Three personal-garment recognition calls occurred in the preceding simulator QA, separately. Latest local daily ledger is25 Meta /28 Serp requests total; this includes earlier work and is not an account balance. Remaining promotional balances are unknown. No Contributor mode, paid infrastructure or image generation was enabled.

## Remaining limitations / manual verification

- **Camera capture has not been manually verified. User testing required.** Simulator gallery tests do not verify physical camera hardware.
- Real microphone capture/permission and speech quality on the user's phone require manual QA; synthetic backend transcription and native entry UI passed.
- Android runtime and real-device notification delivery are untested. Inventory reminders are retired; there is no claimed push/background price scheduler.
- Local backend must remain running and LAN-reachable for Expo Go. Production hosting, signed app-store builds, advanced feed ranking/moderation and calendar OAuth are intentionally deferred.
- Model fit/material/brand observations can be uncertain. Review stays editable. A few photographs do not establish perfect recognition accuracy.
- Public posts are readable by signed-in users; friends-only visibility is enforced separately from group membership. Already issued signed image URLs last up to5minutes. A deleted source garment can leave a fallback in older shared collages.
- Demo posts/interactions are explicitly local/sample data. Live demo AI uses isolated anonymous Firebase authorization; it does not publish fake public social activity.

## Run, demo and resume

```bash
npm install
npm run dev
```

This starts/reuses backend3001 and Expo8081. Scan the terminal QR in SDK58-compatible Expo Go on the same network. The phone's backend URL must use the computer's current LAN address, not localhost. `npm run backend:dev` and `npm run start` can run separately. Existing .env stays ignored; private keys are server-only. SUPABASE_STORAGE_BUCKET=hackTx. META_MODEL=muse-spark-1.2; META_ASR_MODEL=muse-voice-transcribe-1.0. No Contributor.

Read AGENTS.md sections S/T, this status, `docs/DEMO_SCRIPT.md`, `docs/MANUAL_QA.md` and `docs/OUTFIT_PHOTO_QA.md` before continuing. Preserve all user garments and uncommitted work. Do not rerun credit-consuming live checks for routine changes. Remaining work is physical-phone verification and optional deployment/advanced features, not a rebuild.
