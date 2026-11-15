import SafariServices
import UIKit
import WebKit

@MainActor
final class VaraViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let configuration: AppConfiguration
    private(set) var webView: WKWebView!
    private let speech = SpeechController()
    private let statusPanel = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let statusTitle = UILabel()
    private let statusDetail = UILabel()
    private let retryButton = UIButton(type: .system)
    private var loadFailed = false
    private var hapticGeneration = 0
    private let mint = UIColor(red: 235 / 255, green: 247 / 255, blue: 236 / 255, alpha: 1)
    private let green = UIColor(red: 0, green: 120 / 255, blue: 65 / 255, alpha: 1)

    init(configuration: AppConfiguration = .current) {
        self.configuration = configuration
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(configuration:)") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = mint
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.websiteDataStore = .default()
        webConfiguration.defaultWebpagePreferences.preferredContentMode = .mobile
        webConfiguration.allowsInlineMediaPlayback = true
        webConfiguration.applicationNameForUserAgent = "Vara-iOS/1.0"
        let content = webConfiguration.userContentController
        content.add(WeakMessageHandler(self), name: "varaNative")
        content.addUserScript(WKUserScript(source: configuration.bridgeSource(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let cssURL = Bundle.main.url(forResource: "Phone", withExtension: "css")!
        let css = try! String(contentsOf: cssURL, encoding: .utf8)
        let cssData = try! JSONSerialization.data(withJSONObject: css, options: [.fragmentsAllowed])
        let originData = try! JSONSerialization.data(withJSONObject: configuration.origin, options: [.fragmentsAllowed])
        let cssScript = """
        if (location.origin === \(String(data: originData, encoding: .utf8)!)) {
          const style = document.createElement('style');
          style.textContent = \(String(data: cssData, encoding: .utf8)!);
          document.head.appendChild(style);
        }
        """
        content.addUserScript(WKUserScript(source: cssScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = mint
        webView.scrollView.backgroundColor = mint
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.allowsBackForwardNavigationGestures = true
        webView.accessibilityIdentifier = "vara.web"
        #if DEBUG
        webView.isInspectable = true
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // Native insets are applied exactly once. The page is laid out inside the safe rectangle.
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        ])
        makeStatusPanel()
        speech.emit = { [weak self] event in
            guard let self, self.configuration.trusts(self.webView.url) else { return }
            self.webView.callAsyncJavaScript("window.__varaNativeSpeech?.(event)", arguments: ["event": event], in: nil, in: .page) { _ in }
        }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-testing-reset") {
            webConfiguration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self] in self?.loadApp() }
            return
        }
        #endif
        loadApp()
    }

    private func makeStatusPanel() {
        statusPanel.axis = .vertical
        statusPanel.alignment = .center
        statusPanel.spacing = 14
        statusPanel.translatesAutoresizingMaskIntoConstraints = false
        statusPanel.backgroundColor = mint
        statusTitle.font = .preferredFont(forTextStyle: .title2)
        statusTitle.textColor = green
        statusTitle.numberOfLines = 0
        statusTitle.textAlignment = .center
        statusTitle.adjustsFontForContentSizeCategory = true
        statusTitle.accessibilityIdentifier = "vara.status.title"
        statusDetail.font = .preferredFont(forTextStyle: .body)
        statusDetail.textColor = .secondaryLabel
        statusDetail.numberOfLines = 0
        statusDetail.textAlignment = .center
        statusDetail.adjustsFontForContentSizeCategory = true
        var buttonStyle = UIButton.Configuration.filled()
        buttonStyle.baseBackgroundColor = green
        buttonStyle.cornerStyle = .capsule
        buttonStyle.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 24, bottom: 12, trailing: 24)
        retryButton.configuration = buttonStyle
        retryButton.accessibilityIdentifier = "vara.retry"
        retryButton.addTarget(self, action: #selector(loadApp), for: .touchUpInside)
        [spinner, statusTitle, statusDetail, retryButton].forEach(statusPanel.addArrangedSubview)
        view.addSubview(statusPanel)
        NSLayoutConstraint.activate([
            statusPanel.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            statusPanel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 32),
            statusPanel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -32),
            retryButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 48)
        ])
    }

    private func nativeText(_ english: String, _ finnish: String) -> String {
        Locale.preferredLanguages.first?.hasPrefix("fi") == true ? finnish : english
    }

    @objc private func loadApp() {
        loadFailed = false
        statusPanel.isHidden = false
        webView.isHidden = true
        spinner.startAnimating()
        statusTitle.text = "Vara"
        statusDetail.text = nativeText("Opening your money trainer…", "Avataan talousvalmentajaasi…")
        retryButton.isHidden = true
        // Reload the current route after transport failure, without clearing cookies or local state.
        let url = configuration.trusts(webView.url) ? webView.url! : configuration.startURL
        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
    }

    private func showLoadError() {
        loadFailed = true
        webView.isHidden = true
        spinner.stopAnimating()
        statusPanel.isHidden = false
        statusTitle.text = nativeText("Vara couldn’t open", "Varaa ei voitu avata")
        statusDetail.text = nativeText("Check your internet connection and try again. Your saved choices are still here.", "Tarkista verkkoyhteys ja yritä uudelleen. Tallennetut valintasi ovat yhä täällä.")
        retryButton.setTitle(nativeText("Try again", "Yritä uudelleen"), for: .normal)
        retryButton.isHidden = false
        UIAccessibility.post(notification: .screenChanged, argument: statusTitle)
    }

    func stopRecording() {
        hapticGeneration += 1
        speech.abort()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              configuration.trusts(message.frameInfo.request.url),
              configuration.trusts(webView.url),
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "haptic", let pattern = body["pattern"] as? [Double] {
            playHaptic(pattern)
            return
        }
        guard let id = body["id"] as? String, id.count < 80 else { return }
        switch action {
        case "speechStart": speech.start(id: id, language: (body["lang"] as? String) ?? "en-US")
        case "speechStop": speech.stop(id: id)
        case "speechAbort": speech.abort(id: id)
        default: break
        }
    }

    private func playHaptic(_ pattern: [Double]) {
        hapticGeneration += 1
        let generation = hapticGeneration
        var delay = 0.0
        for (index, milliseconds) in pattern.prefix(10).enumerated() {
            guard milliseconds.isFinite, milliseconds >= 0 else { return }
            let duration = min(milliseconds, 200)
            if index.isMultiple(of: 2), duration > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    guard let self, self.hapticGeneration == generation, self.view.window?.windowScene?.activationState == .foregroundActive else { return }
                    UIImpactFeedbackGenerator(style: duration >= 25 ? .medium : .light).impactOccurred()
                }
            }
            delay += duration / 1000
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        // Shopping Lab and Stripe remain embedded, on their original origins, with no native bridge.
        if navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(["https", "about", "blob"].contains(url.scheme ?? "") ? .allow : .cancel)
            return
        }
        if configuration.trusts(url) {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
            } else { decisionHandler(.allow) }
        } else {
            decisionHandler(.cancel)
            openExternal(url)
        }
    }

    private func openExternal(_ url: URL) {
        guard presentedViewController == nil else { return }
        if ["https", "http"].contains(url.scheme ?? "") {
            let browser = SFSafariViewController(url: url)
            browser.preferredControlTintColor = green
            present(browser, animated: true)
        } else if ["mailto", "tel"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if self.configuration.trusts(url) { webView.load(navigationAction.request) }
            else { openExternal(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { stopRecording() }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.isForMainFrame, let response = navigationResponse.response as? HTTPURLResponse, response.statusCode >= 400 {
            decisionHandler(.cancel)
            showLoadError()
        } else { decisionHandler(.allow) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !loadFailed else { return }
        spinner.stopAnimating()
        statusPanel.isHidden = true
        webView.isHidden = false
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { handle(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { handle(error) }
    private func handle(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        showLoadError()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        stopRecording()
        // Do not silently replay checkout, chat requests, or a partially completed flow.
        showLoadError()
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        guard presentedViewController == nil else { completionHandler(); return }
        let alert = UIAlertController(title: frame.securityOrigin.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        guard presentedViewController == nil else { completionHandler(false); return }
        let alert = UIAlertController(title: frame.securityOrigin.host, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: nativeText("Cancel", "Peruuta"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        guard presentedViewController == nil else { completionHandler(nil); return }
        let alert = UIAlertController(title: frame.securityOrigin.host, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: nativeText("Cancel", "Peruuta"), style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }
}

/// WKUserContentController retains its handlers; avoid a controller/web-view retain cycle.
@MainActor
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
