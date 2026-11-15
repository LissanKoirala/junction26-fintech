// Vara API server (Hono). Dev: port 8787 behind Caddy at /api. Prod: also serves the built frontend from dist/.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { AS_OF, isCustomerId, isSlug, loadCustomer, loadCustomerIndex, loadGlobal, loadMl } from "./data";

export const app = new Hono();

app.get("/api/health", async (c) => {
  const index = (await loadCustomerIndex<unknown[]>()) ?? [];
  return c.json({ ok: true, asOf: AS_OF, customers: index.length });
});

app.get("/api/customers", async (c) => c.json((await loadCustomerIndex()) ?? []));

app.get("/api/customer/:id", async (c) => {
  const id = c.req.param("id");
  if (!isCustomerId(id)) return c.json({ error: "bad customer id" }, 400);
  const doc = await loadCustomer(id);
  return doc ? c.json(doc) : c.json({ error: "not found" }, 404);
});

app.get("/api/ml/:kind/:id", async (c) => {
  const { kind, id } = c.req.param();
  if (!isSlug(kind) || !isCustomerId(id)) return c.json({ error: "bad request" }, 400);
  const doc = await loadMl(kind, id);
  return doc ? c.json(doc) : c.json({ error: "not available" }, 404);
});

app.get("/api/global/:name", async (c) => {
  const name = c.req.param("name");
  if (!isSlug(name)) return c.json({ error: "bad request" }, 400);
  const doc = await loadGlobal(name);
  return doc ? c.json(doc) : c.json({ error: "not available" }, 404);
});

// Feature routers (chat etc.) register themselves here. Keep this file small.
const { registerRoutes } = await import("./routes").catch(() => ({ registerRoutes: (_: Hono) => {} }));
registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => console.log(`[api] listening on ${port}, asOf=${AS_OF}`));
