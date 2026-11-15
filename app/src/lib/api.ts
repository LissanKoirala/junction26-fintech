// HTTP client for the Vara API. `?mock=1` (remembered for the session) switches chat and check-in to the local
// mock in ./mock.ts, which builds its answers from the in-browser engine (no invented numbers).
import type { ChatEvent, ChatRequest } from "@shared/chat";
import type { CheckIn } from "@shared/checkin";
import type { CustomerData, CustomerIndexRow } from "@shared/types";
import { getLang, t } from "@shared/i18n";

function readMockFlag(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("mock");
    if (q === "1") sessionStorage.setItem("vara.mock", "1");
    if (q === "0") sessionStorage.removeItem("vara.mock");
    return sessionStorage.getItem("vara.mock") === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("mock") === "1";
  }
}
export const MOCK = readMockFlag();

const customerCache = new Map<string, Promise<CustomerData>>();

export function fetchCustomer(id: string): Promise<CustomerData> {
  const key = id.toUpperCase();
  let p = customerCache.get(key);
  if (!p) {
    p = fetch(`/api/customer/${encodeURIComponent(key)}`).then(async (r) => {
      if (!r.ok) throw new Error(r.status === 404 ? t("No customer with id {id}", { id: key }) : t("Could not load {id} (HTTP {status})", { id: key, status: r.status }));
      return (await r.json()) as CustomerData;
    });
    p.catch(() => customerCache.delete(key));
    customerCache.set(key, p);
  }
  return p;
}

let indexPromise: Promise<CustomerIndexRow[]> | null = null;
export function fetchCustomerIndex(): Promise<CustomerIndexRow[]> {
  if (!indexPromise) {
    indexPromise = fetch("/api/customers").then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as CustomerIndexRow[];
    });
    indexPromise.catch(() => (indexPromise = null));
  }
  return indexPromise;
}

/** GET JSON; resolves null on 404 (e.g. an ML file that has not been produced yet). */
export async function fetchOptional<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchCheckin(id: string, customer: CustomerData | null): Promise<{ data: CheckIn; mocked: boolean }> {
  if (!MOCK) {
    // the server words the check-in with the language model; fall back to the local version if it takes too long
    const d = await Promise.race([
      fetchOptional<CheckIn>(`/api/checkin/${encodeURIComponent(id)}${getLang() === "fi" ? "?lang=fi" : ""}`),
      new Promise<null>((r) => setTimeout(() => r(null), 20000)),
    ]);
    if (d && Array.isArray(d.slides)) return { data: d, mocked: false };
  }
  if (!customer) throw new Error(t("Check-in unavailable"));
  const { mockCheckin } = await import("./mockCheckin");
  return { data: mockCheckin(customer), mocked: true };
}

/** Streams ChatEvents from POST /api/chat (SSE). Falls back to the local mock if MOCK or the endpoint is missing. */
export async function streamChat(
  req: ChatRequest,
  customer: CustomerData | null,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<{ mocked: boolean }> {
  const runMock = async () => {
    const { mockChat } = await import("./mock");
    await mockChat(req, customer, onEvent, signal);
    return { mocked: true };
  };
  if (MOCK) return runMock();
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return { mocked: false };
    return runMock();
  }
  if (res.status === 404 || res.status === 405) return runMock();
  if (!res.ok || !res.body) {
    onEvent({ type: "error", message: t("Vara could not answer right now (HTTP {status}).", { status: res.status }) });
    onEvent({ type: "done" });
    return { mocked: false };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sawDone = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        const ev = JSON.parse(data) as ChatEvent;
        if (ev.type === "done") sawDone = true;
        onEvent(ev);
      } catch {
        /* ignore keep-alives */
      }
    }
  }
  if (!sawDone) onEvent({ type: "done" });
  return { mocked: false };
}
