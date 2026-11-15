import XCTest
import WebKit
@testable import Vara

final class AppConfigurationTests: XCTestCase {
    func testOnlyExactHTTPSOriginCanUseNativeBridge() {
        let config = AppConfiguration()
        XCTAssertTrue(config.trusts(URL(string: config.origin + "/#/vara/chat")))
        XCTAssertTrue(config.trusts(URL(string: config.origin + ":443/api/health")))
        for url in ["http://vara-junction26.swedencentral.cloudapp.azure.com",
                    config.origin + ".attacker.example", config.origin + ":8443",
                    "https://user@vara-junction26.swedencentral.cloudapp.azure.com",
                    "https://vara-shopping-lab.lissanartist.chatgpt.site", "file:///etc/hosts", "about:blank"] {
            XCTAssertFalse(config.trusts(URL(string: url)), url)
        }
        XCTAssertFalse(config.trusts(nil))
    }

    func testOriginDoesNotIncludePageOrFragmentAndNormalizesHTTPSPort() {
        let config = AppConfiguration(baseURL: URL(string: "https://example.com:443/app/?x=1#/koti")!)
        XCTAssertEqual(config.origin, "https://example.com")
        XCTAssertTrue(config.trusts(URL(string: "https://example.com/api/health")))
    }

    @MainActor
    func testNativeSpeechBridgeLoadsBeforeLiveChat() async throws {
        let controller = VaraViewController(configuration: AppConfiguration(baseURL: URL(string: AppConfiguration.productionURL.absoluteString + "/#/vara/chat")!))
        controller.loadViewIfNeeded()
        let webView = controller.webView!
        var result: [String: Any] = [:]
        for _ in 0..<120 {
            if let value = try? await webView.evaluateJavaScript("({ready:document.readyState, origin:location.origin, speech:typeof window.SpeechRecognition, bridge:typeof window.__varaNativeSpeech, native:typeof window.webkit?.messageHandlers?.varaNative, buttons:Array.from(document.querySelectorAll('button')).map(b=>b.getAttribute('aria-label') || b.textContent)})") as? [String: Any] {
                result = value
                if value["ready"] as? String == "complete", value["origin"] as? String == AppConfiguration().origin { break }
            }
            try await Task.sleep(for: .milliseconds(250))
        }
        XCTAssertEqual(result["speech"] as? String, "function")
        XCTAssertEqual(result["bridge"] as? String, "function")
    }

    @MainActor
    func testTransportFailureOffersRetryWithoutClearingPersistentStore() {
        let controller = VaraViewController()
        controller.loadViewIfNeeded()
        controller.webView.stopLoading()
        let store = controller.webView.configuration.websiteDataStore
        XCTAssertTrue(store.isPersistent)
        controller.webView(controller.webView, didFailProvisionalNavigation: nil,
                           withError: NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet))
        let retry = find(view: controller.view, identifier: "vara.retry")
        XCTAssertNotNil(retry)
        XCTAssertFalse(retry!.isHidden)
        XCTAssertTrue(controller.webView.isHidden)
        XCTAssertTrue(controller.webView.configuration.websiteDataStore === store)
    }

    @MainActor
    private func find(view: UIView, identifier: String) -> UIView? {
        if view.accessibilityIdentifier == identifier { return view }
        return view.subviews.lazy.compactMap { self.find(view: $0, identifier: identifier) }.first
    }
}
