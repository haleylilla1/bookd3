import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/ios-fixes";
import { initSentry } from "./lib/sentry";
// Mobile optimizations removed for simplicity

// Initialize Sentry before rendering the app
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
