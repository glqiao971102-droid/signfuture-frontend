// Ensures the "Sales Performance Ledger" app is running on :3200 whenever the
// site starts. The admin Sales Listing page (/admin/sales-listing) embeds that
// app via an iframe to http://localhost:3200, and it holds its data in that
// origin's localStorage + serves an /api/parse-upload endpoint — so it needs its
// own Node server, it can't just be static-hosted from Next.
//
// Runs automatically as npm's `predev` hook before `next dev` (npm run dev is
// what the preview launcher and manual runs both use). Idempotent and
// non-fatal: if :3200 already answers it does nothing; if the sales app can't be
// found it just logs and lets `next dev` continue.
import http from "node:http";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const PORT = 3200;
const SALES_SERVER =
  "C:/Users/User/Documents/sales listing claude/scripts/server.mjs";

function isUp() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: PORT, path: "/index.html", timeout: 1500 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

if (await isUp()) {
  console.log(`[sales-server] already running on :${PORT}`);
} else if (!existsSync(SALES_SERVER)) {
  console.warn(
    `[sales-server] not found at ${SALES_SERVER} — Sales Listing will be empty until it is started.`,
  );
} else {
  const child = spawn(process.execPath, [SALES_SERVER], {
    env: { ...process.env, PORT: String(PORT) },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  console.log(`[sales-server] started on :${PORT}`);
}
