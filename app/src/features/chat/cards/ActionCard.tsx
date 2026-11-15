import { ArrowRight, Link2, PiggyBank, Target, Trophy, type LucideIcon } from "lucide-react";
import { CardFrame } from "@/ui/chat";
import { Button } from "@/ui/kit";
import { navigate } from "@/lib/router";
import type { CardOf } from "./util";

const ICON: Record<CardOf<"action">["action"], LucideIcon> = {
  open_saastaja: PiggyBank, set_goal: Target, start_challenge: Trophy, connect_bank: Link2, open_screen: ArrowRight,
};

function routeFor(card: CardOf<"action">): string {
  switch (card.action) {
    case "open_saastaja":
    case "set_goal":
      return "/flow/goal";
    case "connect_bank":
      return "/flow/connect";
    case "start_challenge":
      return "/flow/checkin";
    case "open_screen": {
      const s = String(card.payload?.screen ?? "today");
      const map: Record<string, string> = { today: "/vara/today", whatif: "/vara/whatif", you: "/vara/you", baskets: "/flow/baskets", checkin: "/flow/checkin", goal: "/flow/goal", connect: "/flow/connect" };
      return map[s] ?? (s.startsWith("/") ? s : "/vara/today");
    }
  }
}

export function ActionCard({ card }: { card: CardOf<"action"> }) {
  return (
    <CardFrame icon={ICON[card.action] ?? ArrowRight} eyebrow="Next step" title={card.title ?? card.label} explain={card.explain}>
      {card.description && <p className="text-sm text-ink-strong">{card.description}</p>}
      <Button className="mt-3" full iconRight={ArrowRight} onClick={() => navigate(routeFor(card))}>
        {card.label}
      </Button>
    </CardFrame>
  );
}
