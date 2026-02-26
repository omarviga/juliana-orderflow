import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CHUNK_RELOAD_KEY = "app:chunk-reload-attempted";

const isChunkLoadError = (value: unknown): boolean => {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "";

  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("loading chunk") ||
    normalized.includes("chunkloaderror")
  );
};

const reloadOnceIfNeeded = () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
};

window.addEventListener("error", (event) => {
  const maybeMessage = event?.message || event?.error;
  if (isChunkLoadError(maybeMessage)) {
    reloadOnceIfNeeded();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  if (isChunkLoadError(reason)) {
    reloadOnceIfNeeded();
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// If app mounted correctly, clear previous one-time reload marker.
sessionStorage.removeItem(CHUNK_RELOAD_KEY);
