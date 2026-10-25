# Physical-device verification

Native iPhone17Pro/iOS26.4/Expo Go58 testing already covered real gallery selection, all three authorized garment photos through Meta/save/restart, keyboard/safe areas/tab icons, photo-only posts, live remix, saved outfit posting and chat previews. Browser and emulator tests complement these checks; see PIVOT_STATUS.md and docs/SIMULATOR_QA.md.

**Do not conduct automated physical camera-capture testing. The user will manually verify camera functionality.** Simulator-only permission/UI checks are authorized; they are not hardware capture tests.

## Phone acceptance

1. On the computer run `npm run dev`. Keep the backend and Expo running. Install SDK58-compatible Expo Go; scan the terminal QR code on the same Wi-Fi. If backend requests fail, open the printed computer LAN URL plus `:3001/health` from the phone; do not use phone localhost. A Metro tunnel does not tunnel the backend.
2. Returning sessions open Feed. New/signed-out users choose Log in or Explore demo. Your real account uses Firebase/Supabase; live demo uses a private guest service session with local demo data.
3. Closet → Add clothing → Take photo. Allow camera access only when you choose this action. Capture one garment; cancel/retry once, then submit. Verify preview orientation/color, editable Meta attributes and save. Do not photograph unrelated personal content.
4. Reopen Closet and restart Expo Go. Confirm the garment and compressed thumbnail remain. For a real account, check private thumbnail sync status and another signed-in device where available. Permission denial must leave Photo library/manual text options usable.
5. Add clothing → Voice. Tap Start voice description, grant microphone permission, describe two or three garments, stop and review the transcript. Correct recognition mistakes before extraction; select/edit entries before saving. Recording should stop by30seconds. Physical microphone capture has not been tested automatically.
6. Feed → Create post → choose Outfit or Clothing and add a photo of your outfit; choose visibility deliberately. Tap Remix; verify every owned piece comes from your actual closet. Shop missing/similar pieces; verify real listing prices and retailer details. Save/share a remix.
7. Use the Messages icon in Feed to send a post/outfit. With a long draft and keyboard open, verify composer/Send remain visible; + dismisses keyboard and retains the draft. Use Done on multiline forms, cancel attachment selection and return naturally. Opening a shared private post must not grant unauthorized access.

If troubleshooting, provide the screen/route, action, plain-language error, platform/Expo Go version and a screenshot with personal details removed. Backend diagnostics may include only safe operation/model/bytes/timing/token/error codes—never credentials, bodies or private signed URLs. Do not share your .env.

## Other unverified scope

- Physical camera capture, actual microphone capture and Android runtime.
- Full VoiceOver/large accessibility-font audit and production signed builds.
- Production backend hosting, scheduled price alerts/push and external calendar OAuth are intentionally deferred; no such background service is claimed.

**Camera capture has not been manually verified. User testing required.**
