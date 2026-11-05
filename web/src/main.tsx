import "@fontsource-variable/mona-sans/standard.css";
import "@fontsource-variable/atkinson-hyperlegible-mono/index.css";
import "./styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

// The dev server only (builds drop it): the devnet's test EVM wallet (lib/devnetEvm.ts, D-030).
if (import.meta.env.DEV && import.meta.env.VITE_NETWORK === "sandbox") void import("./lib/devnetEvm");

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
