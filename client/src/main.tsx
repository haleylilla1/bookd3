import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeMobileOptimization } from "./lib/mobile-optimization";

// Initialize mobile optimizations
initializeMobileOptimization();

createRoot(document.getElementById("root")!).render(<App />);
