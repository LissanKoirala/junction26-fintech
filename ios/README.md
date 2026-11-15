# Vara for iPhone

An installable Swift/UIKit iOS app that hosts the **existing Vara web application** in WKWebView. It is a hybrid app, not a separate SwiftUI reimplementation of the financial screens. This keeps the complete React UI, shared calculation engine, model outputs, streaming responses, customer state, and backend contracts together.

Only `ios/` is added. No existing source, backend, dependency manifest, deployment, or dataset is changed. Development started from main commit `50112a2059e70358c54237d676447aae80a81723`; the `ios-app` branch was fast-forwarded to the latest `main` before this addition was committed.

## Open and run

1. Open `Vara.xcodeproj` in Xcode. The generated project is included; XcodeGen is not required to open or build it.
2. Select the **Vara** scheme and an **iPhone 15 Pro Max** simulator.
3. Run. The app uses the existing deployment at <https://vara-junction26.swedencentral.cloudapp.azure.com> immediately. No Node server, dataset, API key, or separate backend is needed on the Mac.
4. For a physical iPhone, choose your development team in the Vara target's Signing & Capabilities settings and run on the device. No team or signing credentials are committed.

The installed toolchain used here is Xcode 27.2 with the iOS 27.2 SDK and simulator. A connected **physical iPhone 15 Pro Max running iOS 27.2.1** was also found. A signed Debug build was installed on it using the Mac's existing development identity (passed as a command-line override, not stored in the project). Xcode could not launch the physical-device tests because the phone was locked; that waiting run was stopped. Unlock the phone before running device tests. The deployment minimum is iOS 17.0. See the validation report for the current device-test status.

If the active developer directory points to Command Line Tools, these commands select Xcode for this process without changing the Mac's global setting:

```sh
cd /Users/terryhuang/Developer/junction26-fintech/ios
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project Vara.xcodeproj -scheme Vara \
  -destination 'platform=iOS Simulator,name=Vara iPhone 15 Pro Max' \
  -derivedDataPath .build build CODE_SIGNING_ALLOWED=NO
```

## iPhone adaptations

- Portrait layout at the iPhone 15 Pro Max's 430 × 932 logical points (1290 × 2796 pixels).
- UIKit constrains content below the Dynamic Island and above the home indicator. The keyboard layout guide resizes the app, keeping chat and checkout inputs reachable.
- WKWebView uses mobile content mode, light appearance, inline media, persistent cookies/localStorage, and the existing hash router. Back gestures and the web app's own Back controls remain available.
- The native bridge implements the web app's existing SpeechRecognition interface through Apple's Speech and AVAudioEngine frameworks. It preserves English/Finnish push-to-talk, interim text, release-to-send, and tap-to-toggle. Permissions are requested only when the microphone is used. Cancellation, page changes and backgrounding stop recording.
- Existing `navigator.vibrate` calls are mapped to native haptic feedback. Existing Web Audio sounds, mute controls and chime choices are unchanged.
- Small input fonts are raised to 16px to prevent iOS focus zoom. User pinch zoom remains enabled.
- External/new-window web links open in a dismissible Safari sheet; Shopping Lab and Stripe frames retain their own origins. Only the app's exact HTTPS origin, in the main frame, can invoke native speech/haptics.
- A native loading/error/retry screen covers transport failures without clearing saved choices or automatically replaying a checkout.
- The iOS bridge localizes the hosted bank shell's hardcoded Finnish labels, including bottom tabs and accessibility labels, using the web app's selected language. Native status and confirmation controls follow that choice too. Existing product names such as Säästäjä and S-Etukortti Visa retain their names.
- The app icon reproduces the existing sprout in `app/public/favicon.svg`.

## Finding the AI shop

From Home, tap the **Vara** card to open **Today**, then scroll to **Got a craving?**. Enter a craving (or tap an example), tap the arrow, and confirm **I'm in, open the shop** on first use. This opens the generated shop. On the Crave mode screen, **Open Shopping Lab** opens the separate real-product importer and storefront demo. The direct web routes are `#/crave` and `#/crave/lab` respectively.

## Backend and feature parity

The app loads the **live deployed web UI**, not a frozen copy of main's frontend assets. Deployments to that site therefore update the app's web functionality too. Main was inspected for the inventory below; the deployment must continue to match the intended web version. Internet access is required, as it is for the web app's live data/AI features. No offline financial dataset or replacement backend is introduced.

All `/api/*` requests remain same-origin, including customer data, chat SSE, weekly check-in, model/global files, Crave generation and Stripe test-wallet requests. Native code neither duplicates calculations nor intercepts API traffic. The existing synthetic-data disclosure, mock/demo handoffs, test-only payment restrictions, and existing web fallbacks remain in place.

| Existing functionality | iOS handling |
| --- | --- |
| Koti, S-Etukortti, Maksu, Pankki, Minä | Original shell, including its existing static/demo sections |
| Today, safe-to-spend, musts, basket summaries, challenges and savings goals | Original screens, shared engine and customer state |
| Chat, suggested questions, streamed cards, charts, explanations, stop/clear | Original chat/backend; native adapter for the existing microphone control |
| What-if sliders, projection, forecast, reset, chat and goal handoffs | Original simulator and engine |
| Personality, Money Map, twins, forecast, risk, habits, anomalies, home readiness, TransactionGPT, model cards | Original model views and API data |
| Weekly stories and accepting challenges | Original check-in flow and local state |
| Basket drill-down and transaction reclassification | Original explorer and per-customer overrides |
| Goal create/edit/remove and Säästäjä handoff | Original simulated flow |
| Connect/disconnect another bank | Original PSD2 simulation |
| Featured customers and arbitrary customer IDs | Original switcher, including irregular-income customers |
| English/Finnish UI and voice language | Original translations; speech locale passed to native recognizer |
| Crave opt-in, generated shops, images, product details, filters, wishlist, basket, checkout | Original flow and backend |
| Simulated payment, optional Stripe test wallet, reveal, pot/release, diary, inbox and tracking | Original payment/state logic; no real payments added |
| Shopping Lab, embedded importer/storefront and external link | Original third-party HTTPS frame, no bank data sent by native code |
| Sound, chime selection and haptics | Original Web Audio, native haptic adapter |

There is no production bank login in the inspected web application; the existing demo-customer behavior is retained. WKWebView storage is persistent but separate from Safari's storage. Preferences already saved in Safari do not automatically migrate to this app.

## Verification

```sh
node --test Tests/bridge.test.cjs
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodebuild -project Vara.xcodeproj -scheme Vara \
  -destination 'platform=iOS Simulator,name=Vara iPhone 15 Pro Max' \
  -derivedDataPath .build -parallel-testing-enabled NO test CODE_SIGNING_ALLOWED=NO
```

Tests cover exact-origin bridge restrictions, persistent storage on transport failure, native bridge cancellation/late events, speech event ordering, haptic bounds, live navigation, chat/keyboard layout, and feature screens. UI tests use the actual deployed site; they depend on its availability. They reset only this app's WKWebView data via a Debug-only launch flag, never Safari or backend data. Screenshots and accessibility trees are attached to the Xcode test result.

See `Validation/RESULTS.md` for observed results and limitations. Physical-device checks still needed on iOS 27.2.1: microphone permissions and real English/Finnish speech, haptic feel and audio output, and Stripe's optional test wallet with a configured wallet. The simulator cannot establish parity for these hardware/account-dependent capabilities. The existing simulated payment path remains available.

If changing the project structure, regenerate it with `xcodegen generate` from this directory. Regenerate the icon with `swift Scripts/GenerateIcon.swift Vara/Assets.xcassets/AppIcon.appiconset/AppIcon.png`.

## Platform references

- [Apple: keyboard layout guide](https://developer.apple.com/documentation/uikit/adjusting-your-layout-with-keyboard-layout-guide)
- [Apple: speech audio-buffer requests](https://developer.apple.com/documentation/speech/sfspeechaudiobufferrecognitionrequest)
- [WebKit: Safari 16 enables Apple Pay in all WKWebViews](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/)

Wallet visibility still depends on the existing server's test configuration, Stripe's supported environment, registered domain and device wallet. The iOS host does not replace the wallet with a new payment integration.
