// Production requests always target the deployed API. Local development may
// set VITE_API_URL or leave it blank to use Vite's proxy.
const PRODUCTION_API_URL = "https://legal-assist-api.vercel.app";

export const API_BASE_URL = (
  import.meta.env.DEV
    ? import.meta.env.VITE_API_URL || ""
    : PRODUCTION_API_URL
).replace(/\/$/, "");

export function websocketBaseUrl() {
  if (API_BASE_URL) return API_BASE_URL.replace(/^http/i, "ws");
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
}
