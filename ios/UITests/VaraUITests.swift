import XCTest

@MainActor
final class VaraUITests: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launch(_ route: String = "/koti", reset: Bool = true) {
        app.launchArguments = ["-ui-testing-route", route, "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        if reset { app.launchArguments.append("-ui-testing-reset") }
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
    }

    private func capture(_ name: String) {
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name + "-accessibility"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func tapVisible(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 30))
        for _ in 0..<6 {
            if element.isHittable { break }
            app.webViews.firstMatch.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
        element.tap()
    }

    func testGoalPersistsAcrossRelaunchAndCanBeRemoved() {
        launch("/flow/goal")
        let name = app.textFields["Goal name"]
        XCTAssertTrue(name.waitForExistence(timeout: 30))
        name.tap()
        name.typeText("Lapland iOS check")
        tapVisible(app.buttons["Continue"])
        let amount = app.textFields["Amount (€)"]
        XCTAssertTrue(amount.waitForExistence(timeout: 10))
        amount.tap()
        amount.typeText("300")
        tapVisible(app.buttons["Continue"])
        tapVisible(app.buttons["Continue"])
        tapVisible(app.buttons["Save goal"])
        tapVisible(app.buttons["Maybe later"])
        XCTAssertTrue(app.buttons["Continue in Säästäjä"].waitForExistence(timeout: 10))
        capture("17-saved-goal")
        app.terminate()
        launch("/flow/goal", reset: false)
        XCTAssertTrue(app.buttons["Edit goal"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["Lapland iOS check"].exists)
        tapVisible(app.buttons["Remove goal"])
        XCTAssertTrue(app.textFields["Goal name"].waitForExistence(timeout: 10))
    }

    func testSimulatedBankConnectionPersistsAndDisconnects() {
        launch("/flow/connect")
        tapVisible(app.buttons["Choose a bank"])
        let bank = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Bank A (example)'")).firstMatch
        tapVisible(bank)
        tapVisible(app.buttons["Give consent (simulated)"])
        XCTAssertTrue(app.staticTexts["Showing 2 banks (simulated)"].waitForExistence(timeout: 20))
        capture("18-connected-bank")
        app.terminate()
        launch("/flow/connect", reset: false)
        tapVisible(app.buttons["Disconnect"])
        XCTAssertTrue(app.buttons["Choose a bank"].waitForExistence(timeout: 10))
    }

    func testWhatIfAndLanguagePersistence() {
        launch("/vara/whatif")
        let slider = app.sliders["Eating out"]
        XCTAssertTrue(slider.waitForExistence(timeout: 30))
        // WebKit range inputs expose a value but not native scrubber coordinates to XCTest.
        slider.coordinate(withNormalizedOffset: CGVector(dx: 0.66, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: slider.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)))
        XCTAssertTrue(app.buttons["Reset"].waitForExistence(timeout: 10))
        capture("19-whatif-changed")
        app.buttons["Reset"].tap()
        XCTAssertEqual(slider.value as? String, "as now")
        app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Suomi'")).firstMatch.tap()
        XCTAssertTrue(app.buttons["Tänään"].waitForExistence(timeout: 10))
        capture("20-finnish")
        app.terminate()
        launch("/vara/today", reset: false)
        XCTAssertTrue(app.buttons["Tänään"].waitForExistence(timeout: 20))
    }

    func testCraveSimulatedCheckoutAndPotPersistence() {
        launch("/crave?q=sushi")
        tapVisible(app.buttons["I'm in, open the shop"])
        let add = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Add ' AND label ENDSWITH ' to basket'")).firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 90))
        tapVisible(add)
        tapVisible(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'View basket'")).firstMatch)
        tapVisible(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Checkout'")).firstMatch)
        capture("21-crave-checkout")
        tapVisible(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Pay '")).firstMatch)
        let simulated = app.buttons["Or use the simulated pay"]
        if simulated.waitForExistence(timeout: 5) { simulated.tap() }
        let confirm = app.buttons["Double-click to pay"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        capture("22-simulated-payment")
        confirm.doubleTap()
        XCTAssertTrue(app.staticTexts["Nothing is on its way."].waitForExistence(timeout: 30))
        capture("23-crave-reveal")
        app.terminate()
        launch("/crave/pot", reset: false)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Release'")).firstMatch.waitForExistence(timeout: 20))
        capture("24-crave-pot-saved")
    }

    func testHomeAndNavigation() {
        launch()
        XCTAssertTrue(app.buttons["Me"].waitForExistence(timeout: 30))
        capture("01-koti")
        app.buttons["Bank"].tap()
        capture("02-pankki")
        app.buttons["Me"].tap()
        XCTAssertTrue(app.staticTexts["Choose a demo customer"].waitForExistence(timeout: 10))
        capture("03-mina")
        app.buttons["Open Vara chat"].tap()
        XCTAssertTrue(app.textViews["Message Vara"].waitForExistence(timeout: 20))
    }

    func testLanguageUpdatesEntireBankShellAndPersists() {
        launch()
        let englishTabs = ["Home", "S-Benefit Card", "Pay", "Bank", "Me"]
        let finnishTabs = ["Koti", "S-Etukortti", "Maksu", "Pankki", "Minä"]
        for label in englishTabs { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 30), label) }
        XCTAssertTrue(app.staticTexts["Accounts and cards"].exists)
        app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Suomi'")).firstMatch.tap()
        for label in finnishTabs { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 10), label) }
        app.buttons["Pankki"].tap()
        XCTAssertTrue(app.buttons["Maksut ja e-laskut"].waitForExistence(timeout: 10))
        app.descendants(matching: .any).matching(NSPredicate(format: "label == 'English'")).firstMatch.tap()
        for label in englishTabs { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 10), label) }
        XCTAssertTrue(app.buttons["Payments and e-invoices"].waitForExistence(timeout: 10))
        capture("25-bank-english")
        app.buttons["Pay"].tap()
        XCTAssertTrue(app.staticTexts["Pay and transfer"].waitForExistence(timeout: 10))
        app.buttons["S-Benefit Card"].tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Bonus and purchases'")).firstMatch.waitForExistence(timeout: 10))
        app.buttons["Me"].tap()
        XCTAssertTrue(app.staticTexts["Choose a demo customer"].waitForExistence(timeout: 10))
        app.terminate()
        launch(reset: false)
        for label in englishTabs { XCTAssertTrue(app.buttons[label].waitForExistence(timeout: 20), label) }
        capture("26-home-english")
    }

    func testGenerativeShopEntryFromHome() {
        launch()
        tapVisible(app.buttons["Open Vara, your personal economic trainer"])
        let craving = app.textFields["What are you craving?"]
        tapVisible(craving)
        craving.typeText("a cosy hoodie")
        tapVisible(app.buttons["Open the shop"])
        XCTAssertTrue(app.buttons["I'm in, open the shop"].waitForExistence(timeout: 30))
        tapVisible(app.buttons["Open Shopping Lab"])
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label ==[c] 'Shopping Lab'")).firstMatch.waitForExistence(timeout: 20))
        capture("27-shopping-lab-entry")
    }

    func testChatKeyboardAndLiveResponse() {
        launch("/vara/chat")
        let input = app.textViews["Message Vara"]
        XCTAssertTrue(input.waitForExistence(timeout: 30))
        capture("chat-before-keyboard")
        // aria-pressed exposes this web button as a switch to iOS accessibility.
        XCTAssertTrue(app.switches["Hold to talk"].waitForExistence(timeout: 10))
        input.tap()
        input.typeText("How much can I safely spend this week?")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        let send = app.buttons["Send"]
        XCTAssertTrue(send.isHittable)
        XCTAssertLessThanOrEqual(send.frame.maxY, app.keyboards.firstMatch.frame.minY + 2)
        capture("04-chat-keyboard")
        send.tap()
        // Await the streaming answer, not just the user's question.
        let stop = app.buttons["Stop"]
        if stop.waitForExistence(timeout: 5) {
            XCTAssertTrue(stop.waitForNonExistence(timeout: 60))
        }
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'safe to spend'")).firstMatch.waitForExistence(timeout: 30))
        capture("05-chat-answer")
    }

    func testFeatureScreens() {
        let routes: [(String, String, String)] = [
            ("/vara/today", "Today", "06-today"),
            ("/vara/whatif", "What-if", "07-whatif"),
            ("/vara/you", "You", "08-you"),
            ("/vara/you?view=models", "How these models were tested", "09-models"),
            ("/flow/baskets", "Your three baskets", "10-baskets"),
            ("/flow/goal", "Savings goal", "11-goal"),
            ("/flow/connect", "Connect another bank", "12-connect"),
            ("/crave", "Crave mode", "13-crave"),
            ("/crave/pot", "Crave pot", "14-pot"),
            ("/crave/inbox", "Inbox", "15-inbox"),
            ("/crave/lab", "Shopping Lab", "16-shopping-lab")
        ]
        for (route, label, shot) in routes {
            launch(route)
            XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch.waitForExistence(timeout: 30), route)
            capture(shot)
            app.terminate()
        }
    }
}
