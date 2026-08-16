import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const saved = localStorage.getItem("legal_assist_theme");
const theme =
  saved === "light" || saved === "dark"
    ? saved
    : window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
