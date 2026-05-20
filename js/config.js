/**
 * AppConfig — shared client-side config.
 * Loaded before auth.js and nav.js on every page.
 *
 * API URL logic:
 *   - file://  →  local dev without a web server → talk directly to Node on :3000
 *   - localhost / 127.0.0.1 on any port other than 3000  →  Live Server / Vite dev → talk to Node on :3000
 *   - anything else (Tailscale URL, nginx, etc.)  →  production → use relative /api (nginx proxies it)
 */
(function () {
  const { protocol, hostname, port } = window.location;

  const isLocalDev =
    protocol === "file:" ||
    ((hostname === "localhost" || hostname === "127.0.0.1") && port !== "3000");

  window.AppConfig = {
    API: isLocalDev ? "http://127.0.0.1:3000/api" : "/api",
  };
})();
