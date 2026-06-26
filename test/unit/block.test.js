import { blockClass } from "../../src/vm/extensions/block/index.js";

describe("blockClass", () => {
    const runtime = {
        formatMessage: function (msg) {
            return msg.default;
        }
    };

    test("should create an instance of blockClass", () => {
        const block = new blockClass(runtime);
        expect(block).toBeInstanceOf(blockClass);
    });

    test("default recognition and speak languages are ja-JP", () => {
        const block = new blockClass(runtime);
        expect(block.recognitionLanguage).toBe("ja-JP");
        expect(block.speakLanguage).toBe("ja-JP");
    });

    test("setRecognitionLanguage and setSpeakLanguage are independent", () => {
        const block = new blockClass(runtime);
        block.setRecognitionLanguage({LANGUAGE: "ja-JP"});
        block.setSpeakLanguage({LANGUAGE: "en-US"});
        expect(block.recognitionLanguage).toBe("ja-JP");
        expect(block.speakLanguage).toBe("en-US");
    });

    test("setAutoTranslate toggles the flag (default off)", () => {
        const block = new blockClass(runtime);
        expect(block.autoTranslate).toBe(false);
        block.setAutoTranslate({STATE: "on"});
        expect(block.autoTranslate).toBe(true);
        block.setAutoTranslate({STATE: "off"});
        expect(block.autoTranslate).toBe(false);
    });

    test("speechContains matches the latest speech (case-insensitive)", () => {
        const block = new blockClass(runtime);
        block.latestSpeech = "Hello World";
        expect(block.speechContains({WORD: "world"})).toBe(true);
        expect(block.speechContains({WORD: "bye"})).toBe(false);
        expect(block.speechContains({WORD: ""})).toBe(false);
    });

    test("getSpeech returns the latest speech", () => {
        const block = new blockClass(runtime);
        block.latestSpeech = "こんにちは";
        expect(block.getSpeech()).toBe("こんにちは");
    });

    test("isSupported is false when SpeechRecognition is unavailable", () => {
        const block = new blockClass(runtime);
        expect(block.isSupported()).toBe(false);
    });

    test("listenAndWait resolves and records 'unsupported' when unavailable", () => {
        const block = new blockClass(runtime);
        return block.listenAndWait().then(() => {
            expect(block.lastError).toBe("unsupported");
        });
    });

    test("isAcceptableResult rejects empty / symbol-only results", () => {
        const block = new blockClass(runtime);
        expect(block.isAcceptableResult("", 0.9)).toBe(false);
        expect(block.isAcceptableResult("   ", 0.9)).toBe(false);
        expect(block.isAcceptableResult("。。。", 0.9)).toBe(false);
        expect(block.isAcceptableResult("こんにちは", 0.9)).toBe(true);
    });

    test("isAcceptableResult rejects low confidence but keeps unknown (0)", () => {
        const block = new blockClass(runtime);
        expect(block.isAcceptableResult("りんご", 0.2)).toBe(false);
        expect(block.isAcceptableResult("りんご", 0)).toBe(true);
        expect(block.isAcceptableResult("りんご", 0.8)).toBe(true);
    });

    test("default mic sensitivity is normal (threshold 0.5)", () => {
        const block = new blockClass(runtime);
        expect(block.micSensitivity).toBe("normal");
        expect(block.confidenceThreshold).toBe(0.5);
    });

    test("setMicSensitivity changes the confidence threshold", () => {
        const block = new blockClass(runtime);
        // Low sensitivity is the strictest (best in noisy rooms).
        block.setMicSensitivity({LEVEL: "low"});
        expect(block.micSensitivity).toBe("low");
        expect(block.confidenceThreshold).toBe(0.8);
        expect(block.isAcceptableResult("りんご", 0.6)).toBe(false);
        // High sensitivity accepts even low-confidence results.
        block.setMicSensitivity({LEVEL: "high"});
        expect(block.confidenceThreshold).toBe(0);
        expect(block.isAcceptableResult("りんご", 0.1)).toBe(true);
    });

    test("setMicSensitivity falls back to normal for unknown values", () => {
        const block = new blockClass(runtime);
        block.setMicSensitivity({LEVEL: "low"});
        block.setMicSensitivity({LEVEL: "bogus"});
        expect(block.micSensitivity).toBe("normal");
        expect(block.confidenceThreshold).toBe(0.5);
    });

    test("listenAndWait clears the previous result before a new attempt", () => {
        const block = new blockClass(runtime);
        block.latestSpeech = "りんご";
        return block.listenAndWait().then(() => {
            // No new speech was captured, so the stale result must be gone.
            expect(block.getSpeech()).toBe("");
        });
    });

    test("default voice preset is normal", () => {
        const block = new blockClass(runtime);
        expect(block.voicePreset).toBe("normal");
    });

    test("setVoicePreset accepts a known preset and ignores unknown", () => {
        const block = new blockClass(runtime);
        block.setVoicePreset({PRESET: "mouse"});
        expect(block.voicePreset).toBe("mouse");
        block.setVoicePreset({PRESET: "nope"});
        expect(block.voicePreset).toBe("normal");
    });

    test("setRate and setPitch clamp their multipliers", () => {
        const block = new blockClass(runtime);
        block.setRate({RATE: 100});
        expect(block.rateScale).toBe(10);
        block.setPitch({PITCH: -5});
        expect(block.pitchScale).toBe(0);
    });

    test("isSpeakAvailable is false without Audio (test env)", () => {
        const block = new blockClass(runtime);
        expect(block.isSpeakAvailable()).toBe(false);
    });

    test("speak resolves (no sound) when the synthesis service is unavailable", () => {
        const block = new blockClass(runtime);
        return expect(block.speak({TEXT: "hi"})).resolves.toBeUndefined();
    });

    test("speak with auto-translate runs the translation path and resolves", () => {
        const block = new blockClass(runtime);
        block.setRecognitionLanguage({LANGUAGE: "ja-JP"});
        block.setSpeakLanguage({LANGUAGE: "en-US"});
        block.setAutoTranslate({STATE: "on"});
        const originalFetch = global.fetch;
        global.fetch = () => Promise.resolve({
            json: () => Promise.resolve({
                responseStatus: 200,
                responseData: {translatedText: "Hi"}
            })
        });
        return block.speak({TEXT: "こんにちは"}).then(result => {
            global.fetch = originalFetch;
            expect(result).toBeUndefined();
        });
    });

    test("isTranslateAvailable is true when fetch exists and not offline", () => {
        const block = new blockClass(runtime);
        // Node test env provides fetch and no navigator.onLine === false.
        expect(block.isTranslateAvailable()).toBe(true);
    });

    test("translate returns '' for empty text", () => {
        const block = new blockClass(runtime);
        expect(block.translate({TEXT: "  ", LANGUAGE: "en-US"})).toBe("");
    });

    test("translate is a no-op when source equals target", () => {
        const block = new blockClass(runtime);
        // 'Hello' is detected as English; target English -> returned unchanged.
        expect(block.translate({TEXT: "Hello", LANGUAGE: "en-US"})).toBe("Hello");
        // Japanese text with Japanese target -> unchanged.
        expect(block.translate({TEXT: "こんにちは", LANGUAGE: "ja-JP"})).toBe("こんにちは");
    });

    test("translate returns the translatedText from the API", () => {
        const block = new blockClass(runtime);
        const originalFetch = global.fetch;
        global.fetch = () => Promise.resolve({
            json: () => Promise.resolve({
                responseStatus: 200,
                responseData: {translatedText: "Hi"}
            })
        });
        return block.translate({TEXT: "こんにちは", LANGUAGE: "en-US"}).then(result => {
            global.fetch = originalFetch;
            expect(result).toBe("Hi");
        });
    });

    test("translate returns '' on a network failure", () => {
        const block = new blockClass(runtime);
        const originalFetch = global.fetch;
        global.fetch = () => Promise.reject(new Error("network"));
        return block.translate({TEXT: "こんにちは", LANGUAGE: "en-US"}).then(result => {
            global.fetch = originalFetch;
            expect(result).toBe("");
        });
    });

    test("translate returns '' on a MyMemory quota warning", () => {
        const block = new blockClass(runtime);
        const originalFetch = global.fetch;
        global.fetch = () => Promise.resolve({
            json: () => Promise.resolve({
                responseStatus: 403,
                responseData: {translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY."}
            })
        });
        return block.translate({TEXT: "こんにちは", LANGUAGE: "en-US"}).then(result => {
            global.fetch = originalFetch;
            expect(result).toBe("");
        });
    });
});
