#!/usr/bin/env python3
"""Music bed and transition effects for the version 2 videos (ElevenLabs music + sound-effects endpoints).

  ELEVENLABS_API_KEY=... <venv>/bin/python scripts/music-v2.py music <out dir>
  ELEVENLABS_API_KEY=... <venv>/bin/python scripts/music-v2.py sfx   <out dir> [--only name,name]
  <venv>/bin/python scripts/music-v2.py analyse <out dir>
  <venv>/bin/python scripts/music-v2.py synth <out dir>     (the plot-twist effects: stop, slam, pour)

`music` sends a composition plan (generic style words only: no artist, song or vocals) to POST /v1/music
(model music_v1, instrumental) and caches the result as <out>/music-raw.mp3. `sfx` sends one generic prompt
per effect to POST /v1/sound-generation and caches <out>/sfx-raw-<name>.mp3. `analyse` trims, normalises and
encodes everything to m4a, measures the tempo / beats / sections of the bed with librosa and writes
<out>/music.json and <out>/sfx.json (the "music" and "sfx" blocks of src/v2/audio.json).
The key is read from the environment and never printed. Needs ffmpeg and numpy, scipy, soundfile, pyloudnorm,
librosa.
"""
import json, os, pathlib, re, subprocess, sys, time, urllib.error, urllib.request
import numpy as np

BPM = 120
BAR = 4 * 60 / BPM            # 2 s
GLOBAL = ["instrumental", "modern electronic pop", "warm", "confident", "optimistic", "uplifting tech product launch",
          f"steady four-on-the-floor pulse at {BPM} bpm", "punchy kick", "crisp hi-hats", "warm round synth bass",
          "bright plucked synth arpeggio", "airy pads", "major key", "clean polished mix",
          "uncluttered mid-range leaving space for a voice-over"]
NEGATIVE = ["vocals", "singing", "choir", "spoken word", "lyrics", "vocal chops", "dark", "aggressive", "distorted",
            "lo-fi", "dubstep drop", "busy lead melody", "guitar solo"]
# (name, bars, local styles, local negatives). 120 bpm -> 2 s a bar.
PLAN = [
    ("intro", 8, ["starts immediately on the beat, already moving", "kick, hats and pulsing bass from the first bar", "no fade-in"], ["ambient intro", "slow build from silence"]),
    ("build 1", 16, ["adds plucked arpeggio and claps", "energy rising bar by bar", "short riser into the next section"], ["full drop"]),
    ("lift 1", 16, ["the lift: full and bright", "wide pads, bigger drums, open hats", "euphoric but controlled"], ["breakdown"]),
    ("groove 1", 16, ["steady confident groove", "slightly thinner than the lift"], ["vocals"]),
    ("breakdown 1", 8, ["lighter breakdown: pads and soft arpeggio, kick drops out", "keeps the pulse with a soft shaker"], ["silence"]),
    ("build 2", 16, ["kick returns, layers re-enter", "rising tension", "snare roll at the end"], ["full drop"]),
    ("lift 2", 24, ["the biggest lift: full, bright, triumphant", "wide pads, sparkling top line, driving bass"], ["breakdown"]),
    ("groove 2", 16, ["steady confident groove", "warm and positive"], ["vocals"]),
    ("breakdown 2", 8, ["lighter breakdown: pads and soft arpeggio", "soft pulse continues"], ["silence"]),
    ("build 3", 16, ["layers re-enter", "rising energy"], ["full drop"]),
    ("lift 3", 16, ["final lift: full and bright", "confident and happy"], ["breakdown"]),
    ("outro", 8, ["outro: elements drop out one by one", "ends on a clean final hit"], ["long fade"]),
]
SFX = {  # name: (prompt, seconds, prompt_influence)
    "whoosh": ("fast clean air whoosh transition, a short bright swish passing by, modern and smooth", 0.6, 0.6),
    "whoosh2": ("deep smooth swoosh transition passing by, low and airy, short soft tail", 0.8, 0.6),
    "riser": ("tension riser: white noise and synth sweep rising in pitch and volume, building to a peak, cut off abruptly at the very end", 3.5, 0.7),
    "riser2": ("4-second uplifting white noise riser sweep that keeps getting louder and higher in pitch until the very last instant, no impact, no tail, no decay", 4.0, 0.9),
    "impact": ("deep cinematic impact hit: punchy sub boom with a short clean tail", 2.0, 0.6),
    "tick": ("single soft subtle UI tick, a gentle click, clean and quiet", 0.5, 0.6),
    "pop": ("single light bubbly UI pop, short and soft", 0.5, 0.6),
    "shimmer": ("short magical sparkle shimmer, bright glittering chimes rising, clean UI reveal", 1.5, 0.6),
}
# Section boundaries in bars from the first downbeat, read off the bar table (music-bars.json: loudness and
# band energies per bar) after the generation: see the analysis notes in the report.
# Every 16 bars the track has a two-bar break (kick out, cymbal swell: bars 30-31, 46-47, ...) that resolves on
# the next downbeat: the natural place for a riser -> impact. Bar 0 of the raw track was a near-silent pickup
# (-27 LUFS) and is trimmed off (SKIP_BARS), so bar 0 below is the first full bar.
SKIP_BARS = 1
SECTIONS = [("intro", 0), ("build 1", 8), ("groove 1", 16), ("build 2", 24), ("break 1", 30), ("lift 1", 32),
            ("break 2", 46), ("groove 2", 48), ("break 3", 62), ("lift 2", 64), ("break 4", 78), ("peak", 80),
            ("break 5", 94), ("groove 3", 96), ("breakdown 1", 104), ("lift 3", 112), ("breakdown 2", 120),
            ("build 3", 136), ("breakdown 3", 144), ("final lift", 152), ("ending", 163)]
SR = 48000
mode, out = sys.argv[1], pathlib.Path(sys.argv[2]).expanduser()
out.mkdir(parents=True, exist_ok=True)
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
key = os.environ.get("ELEVENLABS_API_KEY", "")


def post(path, body, timeout=600):
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set")
    req = urllib.request.Request(f"https://api.elevenlabs.io{path}", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            if e.code in (401, 402, 403) or attempt == 2:
                sys.exit(f"ElevenLabs refused {path}: {e.code} {msg}")
            time.sleep(5)


def decode(path, ch=2):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()


def encode(x, path, br="192k"):
    import soundfile as sf
    wav = path.with_suffix(".wav")
    sf.write(wav, x.astype(np.float32), SR, subtype="FLOAT")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", br, str(path)])
    wav.unlink()


def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    summ = r[r.rfind("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summ).group(1)) if "inf" not in summ.split("LUFS")[0][-8:] else -70.0
    TP = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summ).group(1))
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)]))
    return I, TP, dur


def tp_db(x):
    from scipy.signal import resample_poly
    return 20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1, axis=0))) + 1e-12)


def synth_riser(path, secs=3.0):
    """A classic noise-sweep riser: band-passed noise whose centre sweeps 300 Hz -> 9 kHz plus two detuned saws
    gliding up an octave, swelling from -30 dB to full level and ending abruptly (3 ms fade)."""
    import soundfile as sf
    rng = np.random.default_rng(7)
    n = int(secs * SR)
    t = np.arange(n) / SR
    u = t / secs
    hop, win = 512, 2048
    outp = np.zeros((n + win, 2))
    freqs = np.fft.rfftfreq(win, 1 / SR)
    wnd = np.hanning(win)
    for k in range(0, n, hop):
        c = 300 * (9000 / 300) ** (k / n)
        shape = np.exp(-0.5 * (np.log2(np.maximum(freqs, 1) / c) / 0.6) ** 2)
        for ch in range(2):
            spec = np.fft.rfft(rng.standard_normal(win) * wnd) * shape
            outp[k:k + win, ch] += np.fft.irfft(spec) * wnd
    noise = outp[:n] / (np.max(np.abs(outp[:n])) + 1e-9)
    f0 = 220 * 2 ** (u ** 1.5)
    ph1 = 2 * np.pi * np.cumsum(f0) / SR
    ph2 = 2 * np.pi * np.cumsum(f0 * 1.007) / SR
    saw = lambda ph: 2 * ((ph / (2 * np.pi)) % 1) - 1
    tone = np.stack([saw(ph1) * 0.6 + saw(ph2) * 0.4, saw(ph1) * 0.4 + saw(ph2) * 0.6], 1)
    from scipy.signal import butter, sosfilt
    tone = sosfilt(butter(2, 3000, "low", fs=SR, output="sos"), tone, axis=0)
    amp = 10 ** ((-30 + 30 * u ** 1.6) / 20)
    y = (noise * 0.8 + tone * 0.35) * amp[:, None]
    y[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))[:, None]
    sf.write(path, (y / np.max(np.abs(y)) * 0.7).astype(np.float32), SR)


def synth_twist(outdir):
    """The plot-twist effects, synthesised: stop (tape-stop pitch drop), slam (heavy short hit), pour (rising
    coin-and-bell arpeggio). Writes sfx-<name>.m4a and sfx-synth.json (lengths, peak times)."""
    from scipy.signal import butter, sosfilt
    rng = np.random.default_rng(11)
    t = lambda secs: np.arange(int(secs * SR)) / SR
    saw = lambda f, tt: 2 * ((f * tt) % 1) - 1
    res = {}
    # stop: a bright chord + pulse, played back at a rate falling from 1 to 0 over 0.78 s
    T = 0.78
    src_t = t(1.2)
    chord = sum(saw(f, src_t) for f in (220, 277.18, 329.63, 440)) / 4
    chord = sosfilt(butter(2, 4000, "low", fs=SR, output="sos"), chord)
    beat = np.sin(2 * np.pi * 55 * src_t) * (np.exp(-((src_t % 0.25) * 18)))
    src = 0.6 * chord + 0.5 * beat + 0.08 * rng.standard_normal(len(src_t))
    tt = t(T)
    rate = (1 - tt / T) ** 1.4
    pos = np.cumsum(rate) / SR
    y = np.interp(pos, src_t, src) * (0.25 + 0.75 * rate)
    lp = np.zeros_like(y)
    for k in range(0, len(y), 512):  # darker as it slows
        cutoff = 300 + 5000 * rate[k] ** 2
        seg = y[max(0, k - 2048):k + 512]
        lp[k:k + 512] = sosfilt(butter(2, cutoff, "low", fs=SR, output="sos"), seg)[-len(y[k:k + 512]):]
    y = lp
    y[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    res["stop"] = np.stack([y, y], 1)
    # slam: noise crack + pitched kick 130 -> 38 Hz + sub tail, saturated
    tt = t(0.65)
    f = 38 + 92 * np.exp(-tt * 28)
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    crack = sosfilt(butter(2, 1500, "high", fs=SR, output="sos"), rng.standard_normal(len(tt))) * np.exp(-tt * 60)
    body = sosfilt(butter(2, [150, 900], "band", fs=SR, output="sos"), rng.standard_normal(len(tt))) * np.exp(-tt * 18)
    kick *= 1 + 1.6 * np.exp(-tt * 35)  # front-loaded so the peak is in the first 20 ms
    y = np.tanh(1.2 * (1.0 * kick + 0.9 * crack + 0.35 * body))
    y[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    res["slam"] = np.stack([y, y], 1)
    # pour: rising bell arpeggio (major pentatonic over two octaves) + coin clinks + airy shimmer, 1.5 s
    L = 1.5
    tt = t(L)
    y = np.zeros((len(tt), 2))
    notes = [523.25, 587.33, 659.25, 783.99, 880.0]
    seq = [n * m for m in (1, 2, 4) for n in notes][:13]
    for i, fr in enumerate(seq):
        st = int(i * 0.085 * SR)
        n = len(tt) - st
        u = np.arange(n) / SR
        g = 0.45 + 0.55 * i / (len(seq) - 1)  # each note a little brighter: it rises
        bell = g * (np.sin(2 * np.pi * fr * u) + 0.4 * np.sin(2 * np.pi * fr * 2.01 * u) + 0.15 * np.sin(2 * np.pi * fr * 3.0 * u)) * np.exp(-u * 6)
        pan = 0.5 + 0.35 * (1 if i % 2 else -1)
        y[st:, 0] += bell * (1 - pan) * 0.5
        y[st:, 1] += bell * pan * 0.5
    for _ in range(18):
        st = int(rng.uniform(0.05, 1.25) * SR)
        n = int(0.25 * SR)
        n = min(n, len(tt) - st)
        u = np.arange(n) / SR
        f0 = rng.uniform(2500, 4200)
        clink = sum(a * np.sin(2 * np.pi * f0 * r * u) for a, r in ((1, 1), (0.6, 2.76), (0.3, 5.4))) * np.exp(-u * 30) * 0.18
        ch = rng.integers(0, 2)
        y[st:st + n, ch] += clink
        y[st:st + n, 1 - ch] += clink * 0.5
    air = sosfilt(butter(2, 6000, "high", fs=SR, output="sos"), rng.standard_normal((len(tt), 2)), axis=0)
    y += air * (0.03 * (tt / L) ** 1.5)[:, None]
    y *= np.minimum(1, (L - tt) / 0.25)[:, None]  # fade over the last 0.25 s
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
    res["pour"] = y
    info = {}
    for name, sig in res.items():
        target = {"stop": -3.0, "slam": -2.0, "pour": -6.0}[name]
        sig = sig * 10 ** ((target - tp_db(sig)) / 20)
        f = outdir / f"sfx-{name}.m4a"
        encode(sig, f)
        I, TP, dur = measure(f)
        e = np.max(np.abs(decode(f)), axis=1)
        w = int(0.005 * SR)
        sm = np.convolve(e, np.ones(w) / w, mode="same")
        on = int(np.argmax(e > e.max() * 10 ** (-40 / 20)))
        info[name] = {"file": f"v2/audio/sfx-{name}.m4a", "seconds": round(dur, 3), "true_peak": TP,
                      "lufs": I if I > -69 else None, "peak": round(float(np.argmax(sm)) / SR, 3),
                      "sound_starts": round(on / SR, 3)}
        print(name, info[name], flush=True)
    (outdir / "sfx-synth.json").write_text(json.dumps(info, indent=1))


if mode == "synth":
    synth_twist(out)

elif mode == "music":
    plan = {"positive_global_styles": GLOBAL, "negative_global_styles": NEGATIVE,
            "sections": [{"section_name": n, "positive_local_styles": p, "negative_local_styles": ng,
                          "duration_ms": int(b * BAR * 1000), "lines": []} for n, b, p, ng in PLAN]}
    (out / "music-plan.json").write_text(json.dumps(plan, indent=1))
    print("planned", sum(b for _, b, _, _ in PLAN) * BAR, "s", flush=True)
    audio = post("/v1/music?output_format=mp3_44100_192", {"composition_plan": plan, "model_id": "music_v1"}, timeout=900)
    (out / "music-raw.mp3").write_bytes(audio)
    print("music-raw.mp3", len(audio), "bytes")

elif mode == "sfx":
    for name, (prompt, secs, infl) in SFX.items():
        if only and name not in only:
            continue
        audio = post("/v1/sound-generation?output_format=mp3_44100_192",
                     {"text": prompt, "duration_seconds": secs, "prompt_influence": infl, "loop": False})
        (out / f"sfx-raw-{name}.mp3").write_bytes(audio)
        print(name, len(audio), "bytes", flush=True)

elif mode == "analyse":
    import pyloudnorm as pyln, librosa
    meter = pyln.Meter(SR)
    # ---- effects
    sfx = {}
    def rises_to_end(path):
        e = np.max(np.abs(decode(path)), axis=1)
        w = int(0.1 * SR)
        sm = np.convolve(e, np.ones(w) / w, mode="valid")
        return np.argmax(sm) >= 0.85 * len(sm), round(float(np.argmax(sm)) / SR, 2), round(len(e) / SR, 2)

    # the riser: the first generated candidate whose loudest point is at its end, else a synthesised one
    riser_src = None
    for cand in ("riser", "riser2"):
        f = out / f"sfx-raw-{cand}.mp3"
        if f.exists():
            ok, at, ln = rises_to_end(f)
            print(f"{cand}: loudest at {at} s of {ln} s", "-> use" if ok else "-> reject", flush=True)
            if ok and riser_src is None:
                riser_src = f
    if riser_src is None:
        synth_riser(out / "sfx-raw-riser-synth.wav")
        riser_src = out / "sfx-raw-riser-synth.wav"
        print("riser: synthesised", flush=True)
    for name in SFX:
        if name == "riser2":
            continue
        raw = riser_src if name == "riser" else out / f"sfx-raw-{name}.mp3"
        if not raw.exists():
            continue
        x = decode(raw)
        env = np.max(np.abs(x), axis=1)
        pk = env.max()
        # onset: first sample within 40 dB of the peak, minus 3 ms
        on = int(np.argmax(env > pk * 10 ** (-40 / 20)))
        a = max(0, on - int(0.003 * SR))
        if name == "riser":
            # the riser must END at its loudest point: smoothed envelope peak in the last 60 %, then a 4 ms fade
            sm = np.convolve(env, np.ones(int(0.02 * SR)) / int(0.02 * SR), mode="same")
            lo = int(len(sm) * 0.4)
            b = lo + int(np.argmax(sm[lo:])) + int(0.01 * SR)
            b = min(b, len(x))
        else:
            # end: last sample within 50 dB of the peak, plus 20 ms fade
            b = len(env) - int(np.argmax(env[::-1] > pk * 10 ** (-50 / 20))) + int(0.02 * SR)
            b = min(b, len(x))
        y = x[a:b].astype(np.float64)
        fo = int((0.004 if name == "riser" else 0.02) * SR)
        y[-fo:] *= np.linspace(1, 0, fo)[:, None]
        y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
        # level: peak at -3 dBTP for the big ones, -6 dBTP for tick / pop / shimmer (UI sounds sit lower)
        target = -6.0 if name in ("tick", "pop", "shimmer") else -3.0
        y *= 10 ** ((target - tp_db(y)) / 20)
        f = out / f"sfx-{name}.m4a"
        encode(y, f)
        I, TP, dur = measure(f)
        e2 = np.max(np.abs(decode(f)), axis=1)
        sm = np.convolve(e2, np.ones(480) / 480, mode="same")
        entry = {"file": f"v2/audio/sfx-{name}.m4a", "seconds": round(dur, 3), "true_peak": TP, "lufs": I}
        if name in ("riser", "impact"):
            entry["peak"] = round(float(np.argmax(sm)) / SR, 3)
        on2 = int(np.argmax(e2 > e2.max() * 10 ** (-40 / 20)))
        entry["sound_starts"] = round(on2 / SR, 3)
        sfx[name] = entry
        print(name, entry, flush=True)
    (out / "sfx.json").write_text(json.dumps(sfx, indent=1))
    # ---- music
    raw = out / "music-raw.mp3"
    if raw.exists() and "--no-music" not in sys.argv:
        x = decode(raw)
        sr2 = 22050

        def grid_fit(mono):
            """Global tempo and phase: the comb over the onset envelope that scores highest (110-124 bpm)."""
            o = librosa.onset.onset_strength(y=mono, sr=sr2, hop_length=128)
            fps = sr2 / 128
            best = (0, 0, 0)
            for per in np.arange(60 / 124, 60 / 110, 0.0002):
                k = np.arange(0, len(o) / fps - per, per)
                for ph in np.arange(0, per, 0.004):
                    sc = o[np.clip(((k + ph) * fps).round().astype(int), 0, len(o) - 1)].mean()
                    if sc > best[0]:
                        best = (sc, per, ph)
            return best[1], best[2], o, fps

        m0 = librosa.resample(x.mean(1), orig_sr=SR, target_sr=sr2)
        per, ph, o, fps = grid_fit(m0[: sr2 * 120])
        # refine the period over the whole track (phase fixed near the start)
        per_best, sc_best = per, 0
        for p2 in np.arange(per - 0.0006, per + 0.0006, 0.00002):
            k = np.arange(ph, len(o) / fps - p2, p2)
            sc = o[np.clip((k * fps).round().astype(int), 0, len(o) - 1)].mean()
            if sc > sc_best:
                per_best, sc_best = p2, sc
        per = per_best
        # downbeat: of the four beat phases, the one where bar-level energy changes are biggest
        S = np.abs(librosa.stft(m0, n_fft=2048, hop_length=512)) ** 2
        fr = librosa.fft_frequencies(sr=sr2, n_fft=2048)
        tt = librosa.times_like(S, sr=sr2, hop_length=512)
        bandsdef = [(0, 150), (150, 500), (500, 3000), (3000, 11000)]
        B = np.stack([10 * np.log10(S[(fr >= lo) & (fr < hi)].sum(0) + 1e-10) for lo, hi in bandsdef])

        def bar_feats(start):
            bar = 4 * per
            nb = int((len(m0) / sr2 - start) // bar)
            F = []
            for k in range(nb):
                msk = (tt >= start + k * bar) & (tt < start + (k + 1) * bar)
                F.append(B[:, msk].mean(1))
            return np.array(F), bar
        best = None
        for q in range(4):
            st0 = ph + q * per
            F, bar = bar_feats(st0)
            nov = np.array([np.abs(F[k:k + 2].mean(0) - F[k - 2:k].mean(0)).sum() for k in range(2, len(F) - 2)])
            sc = np.sort(nov)[-10:].mean()
            if best is None or sc > best[0]:
                best = (sc, st0)
        down = best[1]
        # trim so the file starts 10 ms before the first downbeat (the track opens on the beat)
        a = max(0, int((down + SKIP_BARS * 4 * per - 0.010) * SR))
        y = x[a:].astype(np.float64)
        # drop the trailing silence (keep 0.3 s after the last sound above -60 dBFS)
        e = np.max(np.abs(y), axis=1)
        last = len(e) - int(np.argmax(e[::-1] > 10 ** (-60 / 20)))
        y = y[: min(len(y), last + int(0.3 * SR))]
        shift = a / SR
        for ceil in (-2.0, -2.5, -3.0, -3.5):
            z = y * 10 ** ((-16.0 - meter.integrated_loudness(y)) / 20)
            for _ in range(3):
                lim = 10 ** (ceil / 20); knee = lim * 0.8
                mm = np.abs(z)
                z = np.where(mm > knee, np.sign(z) * (knee + (lim - knee) * np.tanh((mm - knee) / (lim - knee))), z)
                z *= 10 ** ((-16.0 - meter.integrated_loudness(z)) / 20)
            f = out / "music-bed.m4a"
            encode(z, f, "256k")
            I, TP, dur = measure(f)
            if TP <= -1.6:
                break
        first_beat = round(down + SKIP_BARS * 4 * per - shift, 3)
        # bar table on the final file
        mono = decode(f, 1)[:, 0]
        m2 = librosa.resample(mono, orig_sr=SR, target_sr=sr2)
        S = np.abs(librosa.stft(m2, n_fft=2048, hop_length=512)) ** 2
        tt = librosa.times_like(S, sr=sr2, hop_length=512)
        B = np.stack([10 * np.log10(S[(fr >= lo) & (fr < hi)].sum(0) + 1e-10) for lo, hi in bandsdef])
        m0 = m2
        F, bar = bar_feats(first_beat)
        lufs_bar = []
        for k in range(len(F)):
            seg = mono[int((first_beat + k * bar) * SR):int((first_beat + (k + 1) * bar) * SR)]
            lufs_bar.append(round(float(meter.integrated_loudness(np.stack([seg, seg], 1))), 1))
        # tracked beats vs the grid (drift check)
        _, bts = librosa.beat.beat_track(y=m2[: sr2 * 300], sr=sr2, units="time", start_bpm=60 / per)
        gridd = [abs(((b - first_beat) / per) - round((b - first_beat) / per)) * per for b in bts]
        table = [{"bar": k, "t": round(first_beat + k * bar, 3), "lufs": lufs_bar[k],
                  "bands_db": [round(float(v), 1) for v in F[k]]} for k in range(len(F))]
        (out / "music-bars.json").write_text(json.dumps(table, indent=0))
        # the section boundaries (bar numbers), read off music-bars.json: see SECTIONS
        secs = []
        for i2, (n, b0) in enumerate(SECTIONS):
            b1 = SECTIONS[i2 + 1][1] if i2 + 1 < len(SECTIONS) else None
            secs.append({"name": n, "start": round(first_beat + b0 * bar, 3),
                         "end": round(first_beat + b1 * bar, 3) if b1 is not None else round(dur, 3)})
        music = {"bed": {"file": "v2/audio/music-bed.m4a", "seconds": round(dur, 3), "bpm": round(60 / per, 3),
                         "first_beat": first_beat, "beat_period": round(per, 5), "bar_seconds": round(bar, 4),
                         "lufs": I, "true_peak": TP, "sections": secs}}
        tot = S[:, : int(120 * sr2 / 512)].sum()
        spec = {f"{lo}-{hi}": round(float(S[(fr >= lo) & (fr < hi), : int(120 * sr2 / 512)].sum() / tot), 3) for lo, hi in bandsdef}
        diag = {"tracked_beats": len(bts), "beat_vs_grid_median_ms": round(float(np.median(gridd)) * 1000, 1),
                "beat_vs_grid_p95_ms": round(float(np.percentile(gridd, 95)) * 1000, 1), "spectrum_share_first_120s": spec}
        (out / "music.json").write_text(json.dumps(music, indent=1))
        (out / "music-diag.json").write_text(json.dumps(diag, indent=1))
        print(json.dumps(music))
        print(json.dumps(diag))
        for r in table:
            print(r["bar"], r["t"], r["lufs"], r["bands_db"])
