import { createRoot } from "react-dom/client";
import { initializeTheme } from "./hooks/useTheme";
import App from "./App";
import "./index.css";

initializeTheme();

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
