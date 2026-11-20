// Helpers the browser suites share for runs: start a run through the mode dialog, wait for a decision
// or the end, decide, and answer api.anthropic.com from the scripted stand-in (tests/lib/fake-claude.mjs)
// with the CORS headers a browser needs. Nothing here reaches a real API.
import { CORS } from "./harness.mjs";

export const MODEL_IDS = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"];

/** Opens the mode dialog for a run and starts it in a mode ("simulation", "live"). */
export async function startRun(page, { run = "R1", mode = "simulation" } = {}) {
  await page.selectOption("#run-select", run);
  await page.click("#btn-start");
  await page.waitForSelector(".mode-modal", { timeout: 5000 });
  await page.click(`#start-${mode}`);
}

/** Waits until the options of a decision can be decided (Approve enabled). */
export const waitDecision = (page, timeout = 60000) => page.waitForSelector("#btn-approve:not([disabled])", { timeout });

/** Waits until a cluster review waits on the duplicates board. */
export const waitReview = (page, timeout = 60000) => page.waitForSelector('.cluster-card[data-pending="true"]', { timeout });

/** Waits for the status pill to reach a tone ("done", "stopped", "waiting"). */
export const waitTone = (page, tone, timeout = 60000) => page.waitForFunction((t) => document.querySelector("#status-pill")?.dataset.tone === t, tone, { timeout });

/** Picks an option (by id or id suffix), a reason code and a comment, then presses a decision button. */
export async function decide(page, { option, code, comment = "", button = "approve" }) {
  // The option card's label picks it (Vici draws the radio inside the label).
  const card = `article.option-card[id$="${option}"]`;
  await page.locator(`${card} .option-pick`).first().click();
  // Choosing an option re-renders the panel; the choice must have survived it.
  await page.waitForFunction((s) => document.querySelector(`${s} input[name="option-choice"]`)?.checked, card, { timeout: 5000 });
  await page.waitForTimeout(60);
  if (code !== undefined) await page.selectOption("#reason-code", code);
  await page.fill("#decision-comment", comment);
  await page.click(`#btn-${button}`);
  await page.waitForTimeout(80);
}

/** The text of an element with its whitespace collapsed. */
export const textOf = async (page, sel) => ((await page.textContent(sel)) || "").replace(/\s+/g, " ").trim();

/**
 * Answers api.anthropic.com for one page from the stand-in: GET /v1/models lists MODEL_IDS (or answers
 * `modelsStatus`), POST /v1/messages goes to fake.handle. Preflights get their CORS answer.
 */
export async function routeFakeClaude(page, fake, { modelsStatus = 200 } = {}) {
  await page.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...CORS, "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" } });
    if (req.url().includes("/v1/models")) {
      return route.fulfill(modelsStatus === 200
        ? { status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ data: MODEL_IDS.map((id) => ({ id, type: "model" })) }) }
        : { status: modelsStatus, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
    }
    const r = fake.handle(req.postData(), req.headers());
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    return route.fulfill({ status: r.status, headers: { ...CORS, ...r.headers }, body: r.body });
  });
}

/** Enters a key in the key dialog (opened by the Live card) and checks it. */
export async function enterKey(page, key) {
  await page.waitForSelector(".key-modal", { timeout: 5000 });
  await page.fill("#api-key", key);
  await page.click("#key-check");
}

/** Collects the downloads a page makes: { name, text }. */
export function collectDownloads(page) {
  const files = [];
  page.on("download", async (d) => {
    const p = await d.path();
    const { readFile } = await import("node:fs/promises");
    files.push({ name: d.suggestedFilename(), text: await readFile(p, "utf8") });
  });
  return files;
}
