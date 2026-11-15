"""Minimal Claude call through Runware (Anthropic Messages format). Key from env RUNWARE_API_KEY (never printed)."""
import json, os, re, time
import urllib.request, urllib.error

URL = "https://api.runware.ai/v1/messages"
MODEL = "anthropic:claude@opus-5.5"


def ask(system: str, user: str, max_tokens: int = 2000, retries: int = 3) -> str:
    key = os.environ["RUNWARE_API_KEY"]
    body = json.dumps({"model": MODEL, "max_tokens": max_tokens, "system": system,
                       "messages": [{"role": "user", "content": user}]}).encode()
    last = None
    for a in range(retries):
        req = urllib.request.Request(URL, data=body, method="POST", headers={
            "Authorization": f"Bearer {key}", "anthropic-version": "2023-06-01", "content-type": "application/json",
            "User-Agent": "vara-ml/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                j = json.loads(r.read())
            content = j.get("content") or (j.get("data") or [{}])[0].get("content") or []
            return "".join(c.get("text", "") for c in content if isinstance(c, dict))
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read()[:300]!r}"
        except Exception as e:
            last = repr(e)
        time.sleep(3 * (a + 1))
    raise RuntimeError(f"Runware call failed: {last}")


def ask_json(system: str, user: str, max_tokens: int = 2000):
    txt = ask(system, user, max_tokens)
    m = re.search(r"(\[.*\]|\{.*\})", txt, re.S)
    return json.loads(m.group(1) if m else txt)
