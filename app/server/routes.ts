// Central place where feature routers attach to the app. Each feature adds one line here.
import type { Hono } from "hono";
import { registerChatRoutes } from "./chat/route";
import { registerCheckinRoutes } from "./checkin";
import { registerCraveRoutes } from "./crave/route";

export function registerRoutes(app: Hono) {
  registerChatRoutes(app);
  registerCheckinRoutes(app);
  registerCraveRoutes(app);
}
