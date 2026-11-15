#!/usr/bin/env python3
"""Assemble vara-slides.pptx (16:9) from the slide stills rendered by `render-slides2.mjs --jpeg <dir>`.
One full-bleed picture per slide; the speaker notes hold that slide's narration lines (from src/v2/audio.json),
so the presenter can read them or talk around them. Needs python-pptx (run it from a venv outside ~/proj).
    python build-pptx.py <jpg dir> <out.pptx>
"""
import json, os, re, sys
from pptx import Presentation
from pptx.util import Emu

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = json.load(open(os.path.join(HERE, "..", "src", "v2", "audio.json")))["vo"]

# slide → narration (scene, first sentence containing, last sentence containing); mirrors src/slides2/*.tsx
NOTES = [
    [("p1", None, None)],
    [("p2", None, "seven in ten")],
    [("p2", "Among", "Almost always")],
    [("p2", "dips are tiny", None)],
    [("p3", None, None)],
    [("p4", None, None)],
    [("p5", None, "real retailer")],
    [("p5", "Sushi", None)],
    [("p6", None, None)],
    [("p7", None, "Crave pot")],
    [("p7", "She got the hit", None), ("p8", None, None)],
    [("p9", None, None)],
    [("p10", None, "two futures")],
    [("p10", "One forecasts", "One forecasts")],
    [("p10", "We tested", None)],
    [("p11", None, "open banking")],
    [("p11", "Financial literacy", None)],
    [("p12", None, None)],
]
EXTRA = {
    7: "On screen: the shop's text is written live by Gemini (streaming structured output); the product photos come from a separate image model. Live app recording, synthetic data; Aino is a fictional customer.",
    9: "Prototype: money movement is simulated. The wallet button on the pay sheet is Stripe's, in test mode.",
    10: "Prototype: money movement is simulated.",
    11: "Prototype: money movement is simulated; the wallet button comes from Stripe in test mode.",
    5: "A replay of two years of data, all else unchanged. Not a prediction.",
    13: "Model output for the demo customer, synthetic data. Two of the eight models ship; six are labelled experimental.",
    16: "Säästäjä hand-off and open banking are mocks in this prototype.",
}

def lines(scene, a, b):
    S = AUDIO[scene]["sentences"]
    i = 0 if a is None else next(k for k, s in enumerate(S) if a.lower() in s["text"].lower())
    j = len(S) - 1 if b is None else next(k for k, s in enumerate(S) if b.lower() in s["text"].lower())
    return " ".join(s["text"] for s in S[i:j + 1])

def main(jpg_dir, out):
    imgs = sorted(f for f in os.listdir(jpg_dir) if re.match(r"^\d\d-.*\.jpg$", f))
    assert len(imgs) == len(NOTES), (len(imgs), len(NOTES))
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)   # 13.333 × 7.5 in, 16:9
    blank = prs.slide_layouts[6]
    for n, (img, parts) in enumerate(zip(imgs, NOTES), start=1):
        s = prs.slides.add_slide(blank)
        s.shapes.add_picture(os.path.join(jpg_dir, img), 0, 0, width=prs.slide_width, height=prs.slide_height)
        text = " ".join(lines(*p) for p in parts)
        if n in EXTRA: text += "\n\n" + EXTRA[n]
        s.notes_slide.notes_text_frame.text = text
    cp = prs.core_properties
    cp.title, cp.author, cp.last_modified_by, cp.subject, cp.keywords, cp.comments = "Vara · Junction 2026", "Vara team", "Vara team", "", "", ""
    prs.save(out)
    print(out, os.path.getsize(out), "bytes,", len(imgs), "slides")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
