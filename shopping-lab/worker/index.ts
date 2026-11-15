import handler from "vinext/server/fetch-handler";
import { runWithDiscoveryEnv } from "../lib/discovery";
import { runWithImportEnv } from "../lib/shop-importer";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Self-hosted under `wrangler dev` (LAB_BUFFER_REQUEST_BODY=1, body size capped by the reverse proxy): read the body
    // first, because a response sent before the body is consumed (403/415/429 early returns) crashes the local runtime.
    if ((env as { LAB_BUFFER_REQUEST_BODY?: string }).LAB_BUFFER_REQUEST_BODY === "1" && request.body) {
      request = new Request(request, { body: await request.arrayBuffer() });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithImportEnv(env, () => runWithDiscoveryEnv(env, () => runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx))));
  },
};

export default worker;
