#!/usr/bin/env python3
"""Narration for the version 2 videos (script revision 2), made with ElevenLabs: the version 1 narrator, read
fast and expressive (eleven_multilingual_v2, stability 0.25, style 0.6, speed 1.15, up to three takes a scene,
the previous scene sent as `previous_text` so the scenes sound like one session). The pause between
"And then:" and "plot twist" (d5, p7) is cued with a dash and set to 0.45 s in step 3.

  ELEVENLABS_API_KEY=... <venv>/bin/python scripts/narrate-v2.py <out dir> [--only id,id] [--check]

Reads narration-v2.json (the approved text of each scene) and src/v2/facts.json (from the REC builder; d2 and
p5 are skipped until it exists). For each scene:
  1. applies the facts rule to the approved text (-> `text`) and any phonetic respellings (-> `tts`);
  2. calls /v1/text-to-speech/{voice}/with-timestamps (cached in <out>/raw-<id>.mp3 + .json; the cache is
     reused while the text and settings are unchanged);
  3. trims leading / trailing silence to 30 ms and shortens every internal pause longer than 0.30 s to 0.22 s,
     cutting only where the audio is quiet and no letter is being spoken (short crossfades);
  4. normalises to -16 LUFS integrated, true peak under -1.5 dBTP, and writes <out>/vo-<id>.m4a;
  5. maps the API's character timings through the edits to get sentence and word start / end times;
  6. with --check, transcribes the final file with faster-whisper and compares words and times.
Writes <out>/vo.json (the "vo" block of src/v2/audio.json) and <out>/report.json, and updates the `text` / `tts`
fields in <out>/narration-v2.json (copy it back over video/narration-v2.json). Only the narration text is sent to ElevenLabs; the key is read from the
environment and never printed. Needs ffmpeg / ffprobe on PATH and numpy, scipy, soundfile, pyloudnorm
(and faster-whisper for --check).
"""
import base64, difflib, hashlib, json, os, pathlib, re, subprocess, sys, time, urllib.error, urllib.request
import numpy as np

VOICE = os.environ.get("VO_VOICE", "O4fnkotIypvedJqBp4yb")   # the version 1 narrator
MODEL = os.environ.get("VO_MODEL", "eleven_multilingual_v2")
SETTINGS = {"stability": 0.25, "similarity_boost": 0.75, "style": 0.6, "use_speaker_boost": True, "speed": 1.15}
for _k in ("stability", "style", "speed"):  # overrides for trying settings: VO_SPEED=1.05 etc.
    if os.environ.get("VO_" + _k.upper()):
        SETTINGS[_k] = float(os.environ["VO_" + _k.upper()])
# Phonetic respellings sent to the API in place of the true spelling (the true spelling stays in `text`).
# Chosen from whisper tests (true spelling -> transcript): untouched, "S-mobiili" came back as "S-mobile" /
# "S-mobili" and "Säästäjä" as "siaostea"; "Ess-mobeelee" came back as "S-mobily" twice, "Saastaya" as
# "Sastaya" (close to the Finnish SAA-stä-jä); "Sah-stah-yah" gave "Sakhstaya". "Aino" was heard right as is.
# The pause before "plot twist" is cued with a dash (then set to 0.45 s in tighten).
RESPELL = {"S-mobiili": "Ess-mobeelee", "Säästäjä": "Saastaya", "And then: plot twist": "And then: — plot twist"}
# "Aino" was heard right in d2 and p5 but as "Eno" in p10, so p10 alone sends a respelling.
SCENE_RESPELL = {"p10": {"Aino": "Eye-no"}}
NO_RESPELL = {}
RESPELL.update(json.loads(os.environ["VO_RESPELL_ADD"]) if os.environ.get("VO_RESPELL_ADD") else {})
if os.environ.get("VO_RESPELL"):
    RESPELL = json.loads(os.environ["VO_RESPELL"])
# Per-scene time-stretch (pitch kept, ffmpeg rubberband) applied to the API audio before tightening, with the
# character timings scaled to match, e.g. VO_STRETCH='{"d1": 0.95}'.
STRETCH_BY_ID = json.loads(os.environ["VO_STRETCH"]) if os.environ.get("VO_STRETCH") else {}
# The delivered set: the take used per scene (whisper, pace and pitch checked) and the tempo applied to it
# (rubberband, pitch kept) where the chosen take was off the 170-190 words-a-minute pace.
FORCE_TAKE = {"d6": 2, "d4": 0, "d7": 0, "p11": 2}
STRETCH_BY_ID = {"d6": 0.88, "d4": 1.06, "d7": 1.08, "p11": 1.1, **STRETCH_BY_ID}
if os.environ.get("VO_FREE"):  # VO_FREE=1: ignore the delivered choices (fresh take selection, no tempo)
    FORCE_TAKE, STRETCH_BY_ID = {}, {}
# Per-scene speed where the default came out rushed (long lists, the closing motto) or slow.
SPEED_BY_ID = {}
SR = 44100
TAKES, WPM_OK, WPM_AIM = 3, (172, 190), 182
EDGE = 0.030            # silence kept at the start and the end
EDGE_DB = 35            # 'silence' at the edges: frames more than 35 dB under the speech level
MAX_PAUSE, KEEP_PAUSE, TWIST_PAUSE = 0.30, 0.22, 0.45   # V2.md: none over 0.35 s; we tighten a little harder
XF = 0.008              # crossfade at each cut

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]).expanduser()
out.mkdir(parents=True, exist_ok=True)
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
check = "--check" in sys.argv
narr_path = root / "narration-v2.json"
scenes = json.loads(narr_path.read_text())
facts_path = root / "src" / "v2" / "facts.json"
facts = json.loads(facts_path.read_text()) if facts_path.exists() else None
key = os.environ.get("ELEVENLABS_API_KEY", "")


# p5 / d2 timing wording: the owner chose "almost instantly" (now in `approved`), so no override is needed.
WORDING = {}


def apply_facts(s):
    """The V2.md rule for d2 and p5. Returns None while facts.json is missing."""
    t = s["approved"]
    if not s.get("needs_facts"):
        return t
    if facts is None:
        return None
    has = facts["shop_has"]
    for k in ("name", "brands", "products"):
        if not has.get(k, False):
            sys.exit(f"facts.json says the shop has no {k}: the script needs rewriting, stop and report")
    items = ["Its name", "its brands", "its products"] + [w for w in ("photos", "reviews") if has.get(w, False)]
    t = t.replace("Its name, its brands, its products, photos, reviews.", ", ".join(items) + ".")
    hero = facts["build_seconds"]["hero"]
    if "In seconds," in t and s["id"] in WORDING:
        t = t.replace("In seconds,", WORDING[s["id"]])
    elif "In seconds," in t:
        if hero <= 15:
            pass
        elif hero <= 55:
            t = t.replace("In seconds,", "In under a minute,")
        else:
            sys.exit(f"hero build took {hero} s (> 55 s): no approved wording fits, stop and report")
    return t


def respell(t, sid=None):
    for a, b in {**RESPELL, **SCENE_RESPELL.get(sid, {})}.items():
        if a not in NO_RESPELL.get(sid, []):
            t = t.replace(a, b)
    return t


def call_api(tts, settings, prev=None):
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps({"text": tts, "model_id": MODEL, "voice_settings": settings, **({"previous_text": prev} if prev else {})}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if attempt == 3:
                sys.exit(f"ElevenLabs refused: {e.code} {msg}")
            time.sleep(4)
        except urllib.error.URLError:
            if attempt == 3:
                raise
            time.sleep(4)


def decode(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).copy()


def frame_db(x, hop=0.005, win=0.010):
    h, w = int(hop * SR), int(win * SR)
    n = max(1, (len(x) - w) // h + 1)
    idx = np.arange(n)[:, None] * h + np.arange(w)[None, :]
    rms = np.sqrt(np.mean(x[np.clip(idx, 0, len(x) - 1)] ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms), h


def quiet_runs(db, h, thr):
    """(start s, end s) of runs of frames below thr."""
    q = db < thr
    runs, i = [], 0
    while i < len(q):
        if q[i]:
            j = i
            while j < len(q) and q[j]:
                j += 1
            runs.append((i * h / SR, (j * h + int(0.010 * SR)) / SR if j < len(q) else len(q) * h / SR))
            i = j
        else:
            i += 1
    return runs


def letters(align):
    """Indices and times of letters / digits in the alignment."""
    ch, st, en = align["characters"], align["character_start_times_seconds"], align["character_end_times_seconds"]
    return [(i, st[i], en[i]) for i, c in enumerate(ch) if c.isalnum()]


def tighten(x, align):
    """Returns the edited signal and the kept segments [(orig_start, orig_end) | ("sil", seconds)]. The pause
    between "And then:" and "plot twist" is set to TWIST_PAUSE (shortened, or padded with silence)."""
    db, h = frame_db(x)
    ref = np.percentile(db, 95)
    lets = letters(align)
    loud = np.where(db > ref - EDGE_DB)[0]
    a0 = loud[0] * h / SR if len(loud) else 0.0
    b0 = (loud[-1] * h + int(0.010 * SR)) / SR if len(loud) else len(x) / SR
    start, end = max(0.0, a0 - EDGE), min(len(x) / SR, b0 + EDGE)
    chars = "".join(align["characters"])
    tw = None
    k = chars.find("plot twist")
    if k > 0 and "then" in chars[max(0, k - 12):k]:
        j = chars.rfind("n", 0, k)
        tw = (align["character_end_times_seconds"][j], align["character_start_times_seconds"][k])
    cuts, tw_run = [], None
    for qa, qb in quiet_runs(db, h, ref - 38):
        if qa <= a0 or qb >= b0:
            continue
        is_tw = tw is not None and qa < tw[1] + 0.06 and qb > tw[0] - 0.06
        if is_tw and (tw_run is None or qb - qa > tw_run[1] - tw_run[0]):
            tw_run = (qa, qb)
        keep = TWIST_PAUSE if is_tw else KEEP_PAUSE
        if qb - qa <= (TWIST_PAUSE + 0.05 if is_tw else MAX_PAUSE):
            continue
        ca, cb = qa + keep / 2, qb - keep / 2
        if any(ca - 0.03 < s < cb + 0.03 for _, s, e in lets):
            continue
        cuts.append((ca, cb))
    segs, t = [], start
    for ca, cb in cuts:
        segs.append((t, ca))
        t = cb
    segs.append((t, end))
    if tw is not None:
        cur = (tw_run[1] - tw_run[0]) if tw_run else 0.0
        if cur < TWIST_PAUSE - 0.05:
            mid = (tw_run[0] + tw_run[1]) / 2 if tw_run else (tw[0] + tw[1]) / 2
            nseg = []
            for a, b in segs:
                if a < mid < b:
                    nseg += [(a, mid), ("sil", TWIST_PAUSE - cur + XF), (mid, b)]
                else:
                    nseg.append((a, b))
            segs = nseg
    f = int(XF * SR)
    outp = None
    for a, b in segs:
        piece = np.zeros(int(b * SR)) if a == "sil" else x[int(a * SR):int(b * SR)].astype(np.float64).copy()
        if outp is None:
            outp = piece
        else:
            ramp = np.linspace(0, 1, f)
            tail = outp[-f:] * (1 - ramp) + piece[:f] * ramp
            outp = np.concatenate([outp[:-f], tail, piece[f:]])
    fe = int(0.004 * SR)
    outp[:fe] *= np.linspace(0, 1, fe)
    outp[-fe:] *= np.linspace(1, 0, fe)
    return outp, segs


def mapper(segs):
    """orig time -> new time (accounts for the crossfade overlap and inserted silence)."""
    offs, acc = [], 0.0
    for k, (a, b) in enumerate(segs):
        if a == "sil":
            acc += b - XF
            continue
        offs.append((a, b, acc - a))
        acc += (b - a) - XF

    def m(t):
        for a, b, off in offs:
            if t <= b:
                return max(0.0, max(t, a) + off)
        a, b, off = offs[-1]
        return b + off
    return m


def loudness_encode(y, path):
    """-16 LUFS integrated; overs above the ceiling are soft-clipped; re-done until the ENCODED file's true
    peak is under -1.6 dBTP."""
    import pyloudnorm as pyln, soundfile as sf
    meter = pyln.Meter(SR)
    wav = path.with_suffix(".wav")
    ceil_db = -2.2
    for _ in range(6):
        z = y * 10 ** ((-16.0 - meter.integrated_loudness(y)) / 20)
        for _ in range(3):
            lim = 10 ** (ceil_db / 20)
            knee = lim * 0.85
            a = np.abs(z)
            z = np.where(a > knee, np.sign(z) * (knee + (lim - knee) * np.tanh((a - knee) / (lim - knee))), z)
            z = z * 10 ** ((-16.0 - meter.integrated_loudness(z)) / 20)
        sf.write(wav, z.astype(np.float32), SR, subtype="FLOAT")
        subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ar", "48000", "-ac", "1", "-c:a", "aac", "-b:a", "160k", str(path)])
        I, TP, _ = measure(path)
        if TP <= -1.6:
            break
        ceil_db -= 0.5
    wav.unlink()


def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summ = r[r.rfind("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
    TP = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summ).group(1))
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)]))
    return I, TP, dur


SENT = re.compile(r"[^.!?]+[.!?]+(?=\s|$)")
WORD = re.compile(r"[\w'’\-äöåÄÖÅ]+")


def timings(tts, text, align, m):
    ch = align["characters"]
    if "".join(ch) != tts:
        sys.exit("alignment characters do not match the text sent")
    st, en = align["character_start_times_seconds"], align["character_end_times_seconds"]

    def span(a, b):
        idx = [i for i in range(a, b) if ch[i].isalnum()]
        return round(m(st[idx[0]]), 3), round(m(en[idx[-1]]), 3)
    sents_t = [mm.span() for mm in SENT.finditer(tts)]
    sents_x = [mm.group().strip() for mm in SENT.finditer(text)]
    assert len(sents_t) == len(sents_x), "sentence split differs between text and tts"
    sentences = [{"text": sx, **dict(zip(("start", "end"), span(a, b)))} for (a, b), sx in zip(sents_t, sents_x)]
    words_t = [mm.span() for mm in WORD.finditer(tts)]
    words_x = [mm.group() for mm in WORD.finditer(text)]
    if len(words_t) != len(words_x):
        words_x = [tts[a:b] for a, b in words_t]
    words = [{"w": wx, **dict(zip(("start", "end"), span(a, b)))} for (a, b), wx in zip(words_t, words_x)]
    return sentences, words


def longest_pause(y):
    db, h = frame_db(y)
    ref = np.percentile(db, 95)
    runs = quiet_runs(db, h, ref - 38)
    inner = [b - a for a, b in runs if a > 0.08 and b < len(y) / SR - 0.08]
    edge = quiet_runs(db, h, ref - EDGE_DB)
    lead = edge[0][1] if edge and edge[0][0] == 0 else 0.0
    trail = len(y) / SR - edge[-1][0] if edge and edge[-1][1] >= len(y) / SR - 0.011 else 0.0
    return round(max(inner, default=0.0), 3), round(lead, 3), round(trail, 3)


def norm_words(s):
    return [w.lower().strip("'’-") for w in re.findall(r"[\w'’\-]+", s.replace("-", " ")) if w.strip("'’-")]


_whisper = None


def whisper_check(path, sentences, text):
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel("medium.en", device="cpu", compute_type="int8", cpu_threads=16)
    a16 = np.frombuffer(subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"]), dtype=np.float32)
    segs, _ = _whisper.transcribe(a16, language="en", word_timestamps=True, beam_size=5, vad_filter=False)
    ws = [w for s in segs for w in s.words]
    transcript = "".join(w.word for w in ws).strip()
    hyp = [(norm_words(w.word), w.start, w.end) for w in ws]
    flat = [(t, s, e) for toks, s, e in hyp for t in toks]
    ref = norm_words(text)
    sm = difflib.SequenceMatcher(a=ref, b=[t for t, _, _ in flat], autojunk=False)
    numw = set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million point and percent".split())
    diffs = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        r, hh = ref[i1:i2], [t for t, _, _ in flat[j1:j2]]
        # whisper writes numbers as digits: a number said in words is not a difference
        if r and all(w in numw for w in r) and hh and all(re.fullmatch(r"[\d.,%]+|percent|and|million|euros?", w) for w in hh):
            continue
        diffs.append((" ".join(r), " ".join(hh)))
    # sentence starts: whisper start of the word matching each sentence's first word
    amap = {}
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                amap[i1 + k] = j1 + k
    dev, pos = [], 0
    for snt in sentences:
        n = len(norm_words(snt["text"]))
        if pos in amap:
            dev.append(round(flat[amap[pos]][1] - snt["start"], 3))
        if pos + n - 1 in amap:
            dev.append(round(flat[amap[pos + n - 1]][2] - snt["end"], 3))
        pos += n
    return transcript, diffs, dev


results, report = {}, []
prev_report = json.loads((out / "report.json").read_text()) if (out / "report.json").exists() else {}
for s in scenes:
    text = apply_facts(s)
    if text is None:
        print(f"{s['id']:4s} waiting for facts.json", flush=True)
        continue
    s["text"] = text
    tts = respell(text, s["id"])
    if tts != text:
        s["tts"] = tts
    else:
        s.pop("tts", None)
    if only is not None and s["id"] not in only:
        if (out / f"vo-{s['id']}.json").exists():
            results[s["id"]] = json.loads((out / f"vo-{s['id']}.json").read_text())
        continue
    settings = {**SETTINGS, "speed": SPEED_BY_ID.get(s["id"], SETTINGS["speed"])}
    sig = hashlib.sha256(json.dumps([tts, MODEL, VOICE, settings], sort_keys=True).encode()).hexdigest()[:16]
    nwords = len(WORD.findall(text))
    m4a = out / f"vo-{s['id']}.m4a"
    best = None
    # up to TAKES takes: the voice's pace varies from take to take; keep the first one inside WPM_OK,
    # otherwise the one closest to WPM_AIM. Takes are cached as raw-<id>-<n>.mp3 / .json.
    for take in ([FORCE_TAKE[s["id"]]] if s["id"] in FORCE_TAKE else range(TAKES)):
        rawj, rawm = out / f"raw-{s['id']}-{take}.json", out / f"raw-{s['id']}-{take}.mp3"
        cached = json.loads(rawj.read_text()) if rawj.exists() else None
        if not cached or cached.get("sig") != sig or not rawm.exists():
            prev = next((respell(q.get("text", q["approved"]), q["id"]) for q, r in zip(scenes, scenes[1:]) if r["id"] == s["id"] and q["video"] == s["video"]), None)
            resp = call_api(tts, settings, prev)
            with open(out / "chars.log", "a") as fh:
                fh.write(f"{s['id']} {len(tts)}\n")
            rawm.write_bytes(base64.b64decode(resp["audio_base64"]))
            cached = {"sig": sig, "tts": tts, "alignment": resp["alignment"]}
            rawj.write_text(json.dumps(cached, ensure_ascii=False))
        x = decode(rawm)
        if s["id"] in STRETCH_BY_ID:
            fct = STRETCH_BY_ID[s["id"]]
            raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(rawm), "-af", f"rubberband=tempo={fct}:pitch=1:transients=mixed:window=standard:pitchq=quality", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
            x = np.frombuffer(raw, dtype=np.float32).copy()
            al = cached["alignment"]
            cached = {**cached, "alignment": {"characters": al["characters"],
                      "character_start_times_seconds": [v / fct for v in al["character_start_times_seconds"]],
                      "character_end_times_seconds": [v / fct for v in al["character_end_times_seconds"]]}}
        y, segs = tighten(x, cached["alignment"])
        tmp = out / f"take-{s['id']}-{take}.m4a"
        loudness_encode(y, tmp)
        I, TP, dur = measure(tmp)
        wpm = nwords / dur * 60
        cand = (abs(wpm - WPM_AIM), take, tmp, x, segs, cached, I, TP, dur)
        if best is None or cand[0] < best[0]:
            best = cand
        if WPM_OK[0] <= wpm <= WPM_OK[1] or s["id"] in STRETCH_BY_ID:
            break
    _, take, tmp, x, segs, cached, I, TP, dur = best
    tmp.replace(m4a)
    for f in out.glob(f"take-{s['id']}-*.m4a"):
        f.unlink()
    yfin = decode(m4a)
    pause, lead, trail = longest_pause(yfin)
    sentences, words = timings(tts, text, cached["alignment"], mapper(segs))
    entry = {"file": f"v2/audio/vo-{s['id']}.m4a", "seconds": round(dur, 3), "sentences": sentences, "words": words}
    results[s["id"]] = entry
    rep = {"id": s["id"], "video": s["video"], "take": take, "speed": settings["speed"], "raw_seconds": round(len(x) / SR, 2), "seconds": round(dur, 2),
           "words": nwords, "wpm": round(nwords / dur * 60, 1), "lufs": I, "true_peak": TP,
           "longest_pause": pause, "lead": lead, "trail": trail, "cuts": len(segs) - 1}
    try:
        import librosa
        y16 = librosa.resample(yfin.astype(np.float32), orig_sr=SR, target_sr=16000)
        f0, vf, _ = librosa.pyin(y16, fmin=60, fmax=400, sr=16000, frame_length=1024, hop_length=160)
        f0 = f0[vf & ~np.isnan(f0)]
        stt = 12 * np.log2(f0 / np.median(f0))
        dbf, _ = frame_db(yfin)
        rep.update({"f0_median": round(float(np.median(f0)), 1),
                    "pitch_range_st": round(float(np.percentile(stt, 95) - np.percentile(stt, 5)), 2),
                    "energy_sd_db": round(float(np.std(dbf[dbf > np.percentile(dbf, 95) - 30])), 2),
                    "raw_rms_db": round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)), 1),
                    "stretch": STRETCH_BY_ID.get(s["id"]),
                    "inserted_silence": any(a == "sil" for a, _ in segs)})
        tw = [w for w in words if w["w"].lower() in ("then", "plot")]
        k = [i for i in range(len(words) - 1) if words[i]["w"].lower() == "then" and words[i + 1]["w"].lower() == "plot"]
        if k:
            rep["twist_gap"] = round(words[k[0] + 1]["start"] - words[k[0]]["end"], 3)
    except Exception as e:
        rep["stats_error"] = str(e)[:100]
    if check:
        transcript, diffs, dev = whisper_check(m4a, sentences, text)
        rep.update({"transcript": transcript, "diffs": diffs, "max_time_dev": max(map(abs, dev), default=None), "time_devs": dev})
    (out / f"vo-{s['id']}.json").write_text(json.dumps(entry, ensure_ascii=False, indent=1))
    prev_report[s["id"]] = rep
    print(json.dumps(rep, ensure_ascii=False), flush=True)

(out / "report.json").write_text(json.dumps(prev_report, ensure_ascii=False, indent=1))
(out / "vo.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))
(out / "narration-v2.json").write_text("[\n" + ",\n".join("  " + json.dumps(s, ensure_ascii=False) for s in scenes) + "\n]\n")
for v in ("demo", "pitch"):
    reps = [r for r in prev_report.values() if r["video"] == v]
    print(v, "scenes", len(reps), "spoken", round(sum(r["seconds"] for r in reps), 1), "s")
