#!/usr/bin/env node
/** Capture high-resolution screenshots from the live TerraLens application via Chrome CDP.
 * Updates:
 * - docs/screenshots/observatory.jpg (10 groups + 27k distribution ribbon)
 * - docs/screenshots/projection-lab.jpg (Dual linked PCA/t-SNE + enlarged Scree plot with HUD)
 * - docs/screenshots/experiment-bench.jpg (Interactive parameter exploration)
 * - docs/screenshots/reference-audit.jpg (10-group contingency matrix & audit metrics)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCREENSHOTS_DIR = path.join(ROOT, "docs", "screenshots");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("Launching headless Chrome for screenshot capture...");
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new",
    "--remote-debugging-port=9225",
    "--window-size=1440,1050",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
  ]);

  try {
    let version = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch("http://127.0.0.1:9225/json/version");
        version = await res.json();
        break;
      } catch {
        await sleep(250);
      }
    }
    if (!version) throw new Error("Could not connect to Chrome debugging port 9225.");
    console.log("Connected to Chrome:", version.Browser);

    const targetRes = await fetch("http://127.0.0.1:9225/json/new?http://127.0.0.1:5173/", { method: "PUT" });
    const target = await targetRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise(r => (ws.onopen = r));

    let msgId = 0;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const cur = ++msgId;
        const handler = e => {
          const msg = JSON.parse(e.data);
          if (msg.id === cur) {
            ws.removeEventListener("message", handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id: cur, method, params }));
      });
    }

    await send("Page.enable");
    await send("Runtime.enable");

    async function evaluate(expression) {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true });
      return res?.result?.value;
    }

    async function capture(filename) {
      const { data } = await send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 92,
        captureBeyondViewport: false,
      });
      const buffer = Buffer.from(data, "base64");
      const outPath = path.join(SCREENSHOTS_DIR, filename);
      await fs.writeFile(outPath, buffer);
      console.log(`✓ Successfully saved: docs/screenshots/${filename} (${buffer.length} bytes)`);
    }

    // Wait for the React app to initialize and fetch study data
    console.log("Waiting for application to load...");
    for (let i = 0; i < 40; i++) {
      const loaded = await evaluate("!document.querySelector('.view-skeleton') && !document.querySelector('.connection-state') && !!document.querySelector('.app-shell')");
      if (loaded) break;
      await sleep(300);
    }
    await sleep(2000);

    // 1. OBSERVATORY
    console.log("Capturing 1/4: Observatory (10 groups + 27,000-patch ribbon)...");
    await evaluate("window.location.hash = 'observatory'");
    await sleep(2500);
    await capture("observatory.jpg");

    // 2. PROJECTION LAB
    console.log("Capturing 2/4: Projection Lab (PCA vs t-SNE & enlarged Scree HUD)...");
    await evaluate("window.location.hash = 'projections'");
    await sleep(2500);
    await capture("projection-lab.jpg");

    // 3. EXPERIMENT BENCH
    console.log("Capturing 3/4: Experiment Bench...");
    await evaluate("window.location.hash = 'experiments'");
    await sleep(2500);
    await capture("experiment-bench.jpg");

    // 4. REFERENCE AUDIT
    console.log("Capturing 4/4: Reference Audit (Revealing EuroSAT sealed audit table)...");
    await evaluate("window.location.hash = 'evidence'");
    await sleep(1000);
    await evaluate("document.querySelector('#tab-audit')?.click()");
    await sleep(1000);
    await evaluate("document.querySelector('.audit-gate button')?.click()");
    await sleep(2500);
    await capture("reference-audit.jpg");

    ws.close();
    console.log("All 4 application screenshots have been updated with current 10-group UI!");
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
