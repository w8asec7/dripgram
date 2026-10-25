# DripGram web deployment

DripGram uses the existing Expo Web SPA and the same Firebase/Meta/SerpApi/Supabase backend as mobile. There is no separate frontend.

## Current release

- **Published and browser-tested:** https://thread-hacktx-2026-rp.web.app
- **Requested custom domain:** https://dripgram.tech. Firebase custom-domain binding exists. The user entered the provider-generated DNS records; both resolve publicly. Firebase certificate/ownership validation is still pending at the last check. Do not claim the custom domain is ready until HTTPS and the actual app both pass.
- **Current HTTPS backend:** https://computing-ears-witness-ethernet.trycloudflare.com. This is a temporary Cloudflare Quick Tunnel to this laptop's trusted Node server on port3001. Remote visitors do not need to be near the laptop. The laptop, backend and tunnel must remain running and online. Closing the lid or losing connectivity can interrupt live APIs. Static pages remain on Firebase Hosting.
- No Firebase billing was enabled. No paid backend, new storage bucket, Contributor model, or unrelated provider was configured. Private bucket remains **hackTx**.
- The browser build embeds only the public backend origin and public Firebase configuration. Privileged Meta/SerpApi/Supabase credentials remain in the ignored backend environment.

## Restart after stopping the laptop backend

```bash
npm ci
npm run host:backend
```

Leave that terminal open. The helper reuses an existing healthy backend/tunnel; otherwise it starts the trusted backend and a free `cloudflared` tunnel, writes the actual new origin to ignored `.private-cache/public-backend.json`, and keeps macOS awake while its new tunnel runs. It only stops processes it created. Requires the installed `cloudflared` CLI (`brew install cloudflared` if absent), existing backend .env and Node22.13+.

In another terminal:

```bash
npm run publish:web
```

This verified command checks the current HTTPS backend, exports Expo Web with that origin, scans exported files for privileged secrets, then deploys **only Hosting** to the existing Firebase site. It does not overwrite the local phone/LAN environment. Optionally pass an actual existing HTTPS origin: `npm run publish:web -- https://your-real-backend-origin`.

**A Quick Tunnel hostname changes when recreated. Rebuild/redeploy after that change.** The Hosting domain itself remains stable. Do not deploy a live site pointing to localhost or a private LAN address. Do not run unscoped `firebase deploy`: historical Auth config must not disable anonymous demo access.

## Local mobile and static preview

```bash
npm run dev
npm run export
npm run preview:web
```

Development uses Expo8081/backend3001 and the configured phone-reachable LAN origin. The exported static preview serves only dist at http://localhost:8082 with SPA fallback. A local preview is not public hosting. To update the public release, use `publish:web`, which supplies the real HTTPS backend at build time.

## Custom-domain DNS

Firebase generated these records for the existing site; the user has added them:

| Type | Host | Value                              |
| ---- | ---- | ---------------------------------- |
| A    | @    | 199.36.158.100                     |
| TXT  | @    | hosting-site=thread-hacktx-2026-rp |

Preserve unrelated DNS/email records. Nameservers remain .Tech/Orderbox. No www binding is currently claimed. Provider state/evidence: `docs/domain-setup.json`. Wait for Firebase ownership verification and managed certificate issuance, then verify https://dripgram.tech and nested routes. Do not invent DNS verification values or bypass HTTPS.

Firebase Auth authorized domains include dripgram.tech while preserving existing domains. Backend CORS includes exact Firebase Hosting and custom-domain origins, retaining local origins; no wildcard. Public proxy smoke tests verified auth401 and correct CORS preflights.

## Packaging and navigation

`firebase.json` serves only dist, rewrites unknown application paths to index.html, disables index caching and caches hashed Expo assets. **Do not add `**/node_modules/**` to Hosting ignores:** Expo exports icon fonts and Router assets beneath `dist/assets/node_modules`; excluding those served HTML in place of fonts and produced square icons. The deployed Feather TTF is now served as font/ttf,55596bytes, and browser QA requires an actually loaded font.

At desktop widths>=1100, the root Stack shares a244px sidebar across Feed, Messages, Create Post, Settings and details. Do not attach it only to Tabs. Feed's470px photo column is centered in the browser, including when the right panel is hidden. At mobile/tablet sizes the existing bottom-tab behavior remains. Discover uses2/3/4/5/6columns at375/768/1100/1280/1920px; forms/details stay constrained and responsive. Desktop advanced filters remain compact.

## Executed release verification

```bash
THREAD_RUN_LIVE_QA=1 node scripts/verify-hosted-web.cjs
THREAD_RUN_LIVE_QA=1 THREAD_QA_API_URL=https://computing-ears-witness-ethernet.trycloudflare.com npm run test:live
```

The first uses a disposable QA email account and offline browsing fixtures, verifies actual hosted sign-up/sign-in/session persistence, centered Feed, fonts/photos, persistent sidebar and returnable shopping. It makes no model/search calls and removes its account. The second is an explicit limited paid-provider smoke test through the actual public proxy: Firebase/Firestore, private Supabase upload/retrieval/public denial, Meta image/outfit, Shopping and Lens; it cleans only its temporary fixture/account. Do not run it repeatedly for UI work.

Reports: `docs/ux-hosted-results.json`, `docs/ux-native-results.json`, `docs/ux-responsive-results.json`, `docs/ux-live-feedback.json`. Live smoke passing does not imply physical camera testing.

Provider references: [Expo build-time environment variables](https://docs.expo.dev/guides/environment-variables/), [Firebase custom domains](https://firebase.google.com/docs/hosting/custom-domain), [Firebase custom-domain API](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains/create).
