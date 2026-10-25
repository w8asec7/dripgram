# DripGram

**Discover a look. Make it yours.**

An **AI-powered social fashion platform that connects your wardrobe, outfit inspiration, and real-time shopping**, built for HackTX2026. Discover an outfit → recreate it using owned clothes → shop missing pieces → share your fits.

Expo SDK58, React19.3 / React Native0.88, Firebase Authentication/Firestore, Standard Meta Muse1.2, SerpApi and private Supabase **hackTx** image storage. Existing clothing records and photos are preserved. No Jester/comedy features.

## Live web demo and source

- Website: **https://thread-hacktx-2026-rp.web.app**
- Public repository: **https://github.com/w8asec7/dripgram**
- Custom domain: **dripgram.tech** has the correct DNS records; managed HTTPS validation is pending at the latest check.

The live backend currently runs on the demo laptop through an authenticated HTTPS tunnel. Keep that laptop/backend/tunnel online. See [web deployment and restart instructions](docs/WEB_DEPLOYMENT.md): `npm run host:backend`, then `npm run publish:web` if the tunnel origin changes. No paid backend plan was enabled.

The public source excludes credentials, personal garment photographs, private simulator screenshots, local runtime data and temporary provider caches. Bundled demo photography has documented licenses in [asset credits](assets/LICENSE.md). Private QA evidence mentioned in handoff documents remains local by design.

Latest checks:101app tests,47backend tests,19security tests and26browser journeys pass; TypeScript/lint/formatting and Expo Doctor20/20 pass. Responsive web and iPhone17Pro simulator checks were executed. Outfit feedback is preference-only and never changes laundry/availability. See [current status](SOCIAL_FIRST_STATUS.md).

## Run

Node22.13+ and SDK58-compatible Expo Go are required. The existing ignored `.env` is configured; for another installation copy placeholder-only `.env.example` and supply credentials.

```bash
npm install
npm run dev
```

Scan the terminal QR code in Expo Go. Keep phone/computer on the same Wi-Fi; the backend runs on port3001 and Expo on8081. The app derives the backend host from Expo. Open the printed backend URL plus `/health` on your phone to check reachability. Health indicates configuration, not successful provider testing.

Separate terminals: `npm run backend` and `npm run start`. Other previews: `npm run web`, `npm run ios`, `npm run android`. A Metro tunnel alone does **not** expose the backend; for another network configure a trusted HTTPS endpoint through `EXPO_PUBLIC_API_URL`. Phone localhost refers to the phone. No paid hosting/billing has been enabled.

New or signed-out users see **Log in / Explore demo**. Returning sessions open **Feed** directly. Explore demo uses live Meta/SerpApi through an isolated anonymous Firebase session, while its closet/posts/chats stay local and clearly identified as demo. **Offline sample demo** uses rule-based suggestions and fictional shopping/community samples without provider calls. Optional onboarding can be skipped. Do not reset demo unless you intend to remove its local changes.

## Current experience

- Feed: licensed/sample or real-user photographic posts, likes/comments/bookmarks, contextual remix/shopping, Messages in the header and a floating Style Me action. Returning sessions land here. Style Me retains occasions, immediate Meta generation/alternatives, actual garment links and save/share.
- Closet: All/Tops/Bottoms/Shoes, search/filters/favorites, editable photo recognition, compressed persistent private thumbnails, single/bulk deletion. Laundry, counters, check-ins and essentials UI are retired; historical data remains intact and never blocks styling.
- Add clothing: photo, bulk text, or30-second voice description. Meta extracts separate garments; review/correct/select before atomic save. Text/voice-only pieces use honest text/color/icon fallback cards with color/name/fit; add a real photo later.
- Profile: identity/bio/photo, own and saved posts, saved outfits, friends, Settings and seven-day planner. Publish Outfit or Clothing photos; saved-outfit metadata can be attached. Public/friends-only visibility, likes, comments, bookmarks, creator profiles, own post editing/deletion, profile bio/photo. Sample activity is labeled.
- **Remix With My Closet**: reuse selected structured pieces, or analyze a photo-only post once per image version. Match actual owned IDs, explain substitutions, identify missing pieces, save/share and open Discover with search/post context already filled.
- Discover: unified search/sale/category/price/brand filters, large cached incremental feed, stable deduplication, varied categories, product comparison, shopping collection/cart, Meta collection-match suggestions, product watches and manual price refresh. Live prices/retailers come from SerpApi; unavailable fields remain unknown.
- Existing private realtime group/occasion chats: text/replies, saved/selected/AI outfits and post previews. Sharing never modifies clothing inventory or creates wear records. A recipient’s chat membership does not grant access to a private source post.

## Security and cost

Privileged Meta, SerpApi and Supabase credentials are **backend-only**. Firebase’s public app configuration is the only client configuration. `.env` and secret variants are ignored; `.env.example` contains placeholders/nonsecret defaults. `npm run qa:security` scans index/history/exported bundles without printing secrets.

The backend verifies Firebase tokens and uses the caller’s token for Firestore authorization. Private Supabase images use ownership/explicit post/chat checks and five-minute signed URLs. Public posts share only their selected snapshots, never an entire closet. The existing private hackTx bucket is reused; no new account/bucket or paid tier.

Muse Spark: `META_MODEL=muse-spark-1.2`, Standard, minimal reasoning, bounded output2400. Contributor is blocked. Voice uses sponsored `muse-voice-transcribe-1.0` Standard (`META_ASR_MODEL`), official multipart WAV transcription. Audio is capped at30seconds; synthetic-speech live testing succeeded. No generated garment photos, training, scraping or unrelated paid providers.

Caching, request deduplication, compact metadata, photo-version caching, bounded retries and daily request caps conserve credits. No AI/SerpApi call runs merely because a post scrolls into view. Prices refresh manually; there is no automatic tracking scheduler or push infrastructure. Credit balances are unknown.

## Verification

```bash
npm run typecheck
npm run typecheck:backend
npm run lint
npm test
npm run test:backend
npm run test:rules
npm run test:e2e
npm run qa:visual
npm run qa:security
npm run format:check
npx expo-doctor
npm run export
```

Default tests use fixtures and consume no provider credits. Rules tests need Java17+; Playwright may need `npx playwright install chromium`. Browser visual QA explicitly uses offline demo and writes ignored `.private-cache/pivot-visual` images. Web export is an SPA requiring route fallback to index.html; it is not a signed native release.

See [current status](SOCIAL_FIRST_STATUS.md), [agent handoff](AGENTS.md), [native QA](docs/SIMULATOR_QA.md), [real outfit-photo QA/live reproduction](docs/OUTFIT_PHOTO_QA.md), [demo script](docs/DEMO_SCRIPT.md), and [phone QA](docs/MANUAL_QA.md). Earlier phase documents are historical. Guarded live tests use only disposable qa-number@example.test accounts and their temporary objects; existing Firebase CLI authentication is required for cleanup.

**Camera capture has not been manually verified. User testing required.** The iPhone simulator’s real photo picker, recognition/save/restart, keyboard/safe areas and core social flows were tested independently. Physical camera/microphone capture and Android runtime still need device verification.

The visual identity is dark forest green. All active demo fashion imagery is real, licensed photography bundled locally; no illustrations, animated fashion assets or generated product drawings. Catalog substitutes are labeled representative. Original user photos are preserved. Photo credits are available in Settings and assets/LICENSE.md.
