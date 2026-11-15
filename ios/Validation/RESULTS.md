# iOS validation — 15 November 2026

## Language picker fix (follow-up)

- Added an iOS-only adapter for the deployed bank shell's hardcoded Finnish text and accessibility labels. Native loading/error/confirmation strings now follow the app choice. Brand/product names remain unchanged.
- Final run `.build/LanguageVerified.xcresult`: **2/2 UI tests passed**, covering English → Finnish → English across all five bottom tabs, bank/payment/loyalty screens, persistence after relaunch, and Home → Vara → craving entry → Shopping Lab. Summary: `language-summary.json`.
- Native bridge tests: **5/5 passed**. Signed device build succeeded and the updated app was installed on the connected iPhone 15 Pro Max. Runtime regression checks used the iOS 27.2 simulator; no physical-device test claim is made for this follow-up.
- `Screenshots/26-home-english.png` shows the final English home screen and bottom navigation. The UI test bundle also contains bank and Shopping Lab screenshots.

Implementation branch: `ios-app`, developed from `origin/main` at `50112a2059e70358c54237d676447aae80a81723` and fast-forwarded to the latest `main` before commit. All additions are under `ios/`; existing tracked files are unchanged. The user explicitly requested the commit and push to `main`.

## Environment

- Xcode 27.2 (`27B52`), iOS SDK 27.2.
- Created simulator: **Vara iPhone 15 Pro Max**, UDID `BFA0D922-9ACE-4ED0-9F52-1F4E080A7F13`.
- Simulator runtime: **iOS 27.2 (`24B8117`)**, iPhone 15 Pro Max, 430 × 932 points.
- No iOS 27.2.1 simulator runtime is installed. A **physical iPhone 15 Pro Max running iOS 27.2.1 (`24B156`)** is paired, connected, and has Developer Mode enabled. A signed build was installed; Xcode's test launch was blocked by the device lock. Deployment minimum is 17.0.
- Used `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` per command; the Mac's global developer-directory selection was not changed.

## Passed checks

| Check | Observed result |
| --- | --- |
| Debug simulator build | Passed; app installed and launched on the iPhone 15 Pro Max simulator |
| Release build for generic physical iOS device | Passed with `CODE_SIGNING_ALLOWED=NO`; not signed or installed on a physical phone |
| Signed Debug build for the connected iPhone 15 Pro Max | Passed using the Mac's existing development identity as a command-line override; Vara 1.0.0 (1) is installed on the phone |
| Physical-device XCTest launch | Blocked: Xcode reported “Unlock Terry’s iPhone to Continue”. The waiting test run was stopped; no physical runtime tests completed. The app remains installed. |
| Native XCTest tests (4) | Exact HTTPS-origin allowlist; URL normalization; transport failure preserves persistent data store and offers retry; native speech shim available on the live chat page |
| JavaScript bridge tests (5) | Frame/origin isolation; interim/final event ordering; abort and stale-callback handling; permission denial and restarting; bounded haptic patterns |
| Home/navigation UI test | Koti, Pankki, Minä and opening chat passed |
| Live chat/keyboard UI test | Typed a question, verified Send stayed above the keyboard, received the live backend response with a safe-to-spend card |
| Feature-screen UI test | Today, What-if, You, model cards, baskets, goal, bank connection, Crave intro, pot, inbox and Shopping Lab rendered |
| Goal persistence UI test | Created a goal, dismissed the simulated handoff, relaunched, found the same goal and removed it |
| Bank connection UI test | Connected the existing example bank through simulated consent, relaunched, found the connection and disconnected it |
| What-if/language UI test | Dragged a spending slider, reset it, switched to Finnish and verified Finnish persisted after relaunch |
| Crave UI test | Opted in, loaded the sushi shop, added a product, checked out with simulated pay, saw the reveal, relaunched and found the saved purchase in the pot |
| Backend read checks | All 22 checked customer/model/global/health/wallet endpoints returned HTTP 200 and JSON; health reports 5,100 customers and `asOf: 2026-09-30` |
| Release configuration | Production HTTPS origin retained; Debug-only UI-test reset/route arguments absent from Release executable |
| Repository scope | No existing tracked file modified; new files only in `ios/` |

There are **7 UI test methods**, **4 native test methods**, and **5 JavaScript tests**. Their latest completed simulator/Node runs all passed. Tests were run in focused batches; not every historical result bundle is green. Earlier UI failures came from test automation assumptions (a microphone toggle exposed as a Switch, WebKit range inputs lacking native scrubber coordinates, and the goal handoff sheet needing dismissal). These were corrected in the tests and the affected tests rerun successfully.

Local result bundles (ignored build output):

- `.build/SimulatorTests.xcresult`: successful home/navigation and feature-screen tests; superseded microphone locator failure.
- `.build/ChatVerified.xcresult`: **5/5 passed** (4 native tests and live chat UI test).
- `.build/StateTests.xcresult`: successful bank-persistence test; superseded goal/slider automation failures.
- `.build/FlowsVerified.xcresult`: **3/3 passed** (goal, What-if/language, Crave checkout/persistence).

The compact summaries are `chat-summary.json`, `flows-summary.json` and `backend-check.json`. `Screenshots/` contains captured views, including the chat keyboard, live answer, Finnish UI, Shopping Lab, simulated payment and persisted pot. Visual inspection confirmed the top safe area, full phone width, readable cards and accessible bottom controls on the inspected screens.

## Limits and remaining device checks

- This is a **native host of the live web app**, not a separate native rewrite. Feature parity comes from running the existing implementation and backend. Future web deployments also change the hosted UI. The branch does not freeze a copy of deployed assets.
- The iOS 27.2.1 phone is available but locked. Xcode cannot launch tests until it is unlocked, so the completed UI/runtime results above are from the iOS 27.2 simulator. Actual microphone recognition in English/Finnish, haptic feel, audio routing and interruptions also require a real-device pass.
- The server reported that its optional **Stripe test wallet is enabled**. Its wallet UI/payment completion was not verified with a configured physical-device wallet. The existing simulated checkout path was exercised; no real payment was made and no new payment integration was added.
- The tests cover the listed paths and behaviors, not every possible customer, chart interaction, generated chat-card variant, weekly story, product filter or Shopping Lab import. Those continue to use the unmodified web implementations. No claim of exhaustive end-to-end coverage is made.
- Opening the app requires the existing deployment to be reachable. The original web app's own fallback behavior is retained; the host adds a transport-error retry screen, not an offline backend.
- Rebuilding for a device requires selecting a development team/signing identity in Xcode or passing it to `xcodebuild`. Development signing and installation were completed; App Store distribution was not requested or performed.

The one-time scheduler entry was deleted at the start of this run and will not repeat.
