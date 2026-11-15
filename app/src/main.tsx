import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/schibsted-grotesk";
import "./styles/tokens.css";
import App from "./App";
import { initLang } from "@/lib/i18n";

initLang();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
