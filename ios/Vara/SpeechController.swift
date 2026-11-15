import AVFoundation
import Speech

/// Adapts the web app's push-to-talk contract to Apple's recognizer.
/// It does not call Vara's backend: the existing useSpeech hook sends the final text.
@MainActor
final class SpeechController {
    var emit: (([String: Any]) -> Void)?
    private var sessionID: String?
    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?
    private var transcript = ""
    private var stopping = false
    private var finishTimer: Task<Void, Never>?

    func start(id: String, language: String) {
        abort()
        sessionID = id
        transcript = ""
        stopping = false
        Task { [weak self] in
            let authorized = await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
            }
            guard let self, self.sessionID == id else { return }
            guard authorized else { self.fail("not-allowed"); return }
            let microphone = await withCheckedContinuation { continuation in
                AVAudioApplication.requestRecordPermission { continuation.resume(returning: $0) }
            }
            guard self.sessionID == id else { return }
            guard microphone else { self.fail("not-allowed"); return }
            self.beginAudio(id: id, language: language)
        }
    }

    private func beginAudio(id: String, language: String) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
            fail("language-not-supported"); return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true)
            let engine = AVAudioEngine()
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0 && format.channelCount > 0 else { fail("audio-capture"); return }
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.taskHint = .dictation
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
            self.engine = engine
            self.request = request
            self.recognizer = recognizer
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                Task { @MainActor in
                    guard let self, self.sessionID == id else { return }
                    if let result {
                        self.transcript = result.bestTranscription.formattedString
                        if result.isFinal { self.finish(sendTranscript: true); return }
                        self.emit?(["id": id, "type": "result", "text": self.transcript, "final": false])
                    }
                    if error != nil {
                        if self.stopping && !self.transcript.isEmpty { self.finish(sendTranscript: true) }
                        else { self.fail("no-speech") }
                    }
                }
            }
            engine.prepare()
            try engine.start()
            emit?(["id": id, "type": "start"])
        } catch { fail("audio-capture") }
    }

    func stop(id: String) {
        guard sessionID == id, !stopping else { return }
        stopping = true
        // Release while a permission sheet is open must not begin recording later.
        guard let engine, let request else { finish(sendTranscript: false); return }
        engine.stop()
        request.endAudio()
        finishTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, let self, self.sessionID == id else { return }
            self.finish(sendTranscript: true)
        }
    }

    func abort(id: String? = nil) {
        guard id == nil || id == sessionID else { return }
        finish(sendTranscript: false)
    }

    private func fail(_ code: String) {
        guard let id = sessionID else { return }
        emit?(["id": id, "type": "error", "error": code])
        finish(sendTranscript: false)
    }

    private func finish(sendTranscript: Bool) {
        guard let id = sessionID else { return }
        sessionID = nil // Ignore cancellation callbacks and delayed permission responses.
        finishTimer?.cancel()
        finishTimer = nil
        if let engine {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        engine = nil
        request = nil
        task = nil
        recognizer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if sendTranscript && !transcript.isEmpty {
            emit?(["id": id, "type": "result", "text": transcript, "final": true])
        }
        emit?(["id": id, "type": "end"])
        transcript = ""
    }
}
