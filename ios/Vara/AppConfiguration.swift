import Foundation

struct AppConfiguration {
    static let productionURL = URL(string: "https://vara-junction26.swedencentral.cloudapp.azure.com")!
    let baseURL: URL

    init(baseURL: URL = AppConfiguration.productionURL) {
        precondition(baseURL.scheme == "https" && baseURL.host != nil && baseURL.user == nil && baseURL.password == nil)
        self.baseURL = baseURL
    }

    static var current: AppConfiguration {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "VaraBaseURL") as? String,
              let url = URL(string: raw) else { return AppConfiguration() }
        return AppConfiguration(baseURL: url)
    }

    var origin: String {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = ""
        components.query = nil
        components.fragment = nil
        if components.port == 443 { components.port = nil }
        return components.string!
    }

    func trusts(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host?.lowercased() == baseURL.host?.lowercased()
            && (url.port ?? 443) == (baseURL.port ?? 443) && url.user == nil && url.password == nil
    }

    var startURL: URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        #if DEBUG
        // UI-test-only route selection. No alternate server, mock backend, or credentials.
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-ui-testing-route"), args.indices.contains(index + 1),
           args[index + 1].hasPrefix("/") {
            components.fragment = args[index + 1]
        }
        #endif
        return components.url!
    }

    func bridgeSource(bundle: Bundle = .main) -> String {
        let url = bundle.url(forResource: "NativeBridge", withExtension: "js")!
        let source = try! String(contentsOf: url, encoding: .utf8)
        let encoded = try! JSONSerialization.data(withJSONObject: origin, options: [.fragmentsAllowed])
        return source.replacingOccurrences(of: "__VARA_ORIGIN_JSON__", with: String(data: encoded, encoding: .utf8)!)
    }
}
