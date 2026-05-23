import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeGlobalErrorHandlers } from "@/services/logger";

initializeGlobalErrorHandlers("Painel Lojista");

createRoot(document.getElementById("root")!).render(<App />);
