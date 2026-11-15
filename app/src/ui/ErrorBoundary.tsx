// Keeps one broken card or screen from blanking the whole app.
import { Component, type ReactNode } from "react";
import { t, tData } from "@/lib/i18n";
import { Unavailable } from "./kit";

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode; label?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error) {
    console.warn("[boundary]", this.props.label ?? "", err.message);
  }
  render() {
    if (this.state.err)
      return (
        this.props.fallback ?? (
          <Unavailable
            compact
            title={this.props.label ? t("{label} could not be shown", { label: tData(this.props.label) }) : t("This part could not be shown")}
            reason={t("Something went wrong here. The rest of Vara still works.")}
          />
        )
      );
    return this.props.children;
  }
}
