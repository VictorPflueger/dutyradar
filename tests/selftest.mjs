// Self-test suite, AC-28: "Run all tests" in Assumptions & diagnostics runs the golden cases G1–G8, the
// fact-auditor cases A01–A31 and the cluster cases K1–K9 in the browser, from the same fixture files as
// the unit tests (tests/fixtures/), and shows every case passing, in English and in German. The suite
// proves the self-test can fail: with a golden case's expected value changed on its way to the page, that
// case shows as failed with its expected and actual value. Under Node, js/selftest.js runs the same cases
// and reports the same counts.
// Usage: node tests/selftest.mjs [--browser=chromium|firefox|webkit]
import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT, BROWSER_NAME, launchBrowser, serveStatic } from "./lib/harness.mjs";
import { openApp } from "./lib/page.mjs";
import { t, plain } from "./lib/story-node.mjs";
import { runSelfTest, FIXTURES } from "../js/selftest.js";

let failed = 0;
let checks = 0;
const check = (label, ok, detail = "") => { checks += 1; if (!ok) { failed += 1; console.log(`FAIL [${BROWSER_NAME}] ${label}${detail ? `\n  - ${String(detail).slice(0, 700)}` : ""}`); } };
const json = (p) => JSON.parse(readFileSync(path.join(APP_ROOT, p), "utf8"));
const fx = { golden: json(FIXTURES.golden).golden_cases, audit: json(FIXTURES.audit).cases, cluster: json(FIXTURES.cluster).cases };
const ids = { golden: fx.golden.map((c) => c.id), audit: fx.audit.map((c) => c.id), cluster: fx.cluster.map((c) => c.id) };
const total = ids.golden.length + ids.audit.length + ids.cluster.length;

// Node: the module the page runs, on the same files.
const nodeFetch = async (p) => new Response(readFileSync(path.join(APP_ROOT, p)));
const inNode = await runSelfTest(nodeFetch);
check("Node: the self-test runs every fixture case", inNode.total === total && inNode.groups.map((g) => g.cases.map((c) => c.id).join()).join("|") === [ids.golden, ids.audit, ids.cluster].map((x) => x.join()).join("|"), `${inNode.total} of ${total}`);
check("Node: every case passes", inNode.failed === 0, inNode.groups.flatMap((g) => g.cases.filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`)).join("; "));
check("the three groups: golden, auditor, cluster", inNode.groups.map((g) => g.id).join() === "golden,audit,cluster");

/** Opens Diagnostics, runs the self-test and reads what the page shows. */
async function runInPage(page) {
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-modal #diag-selftest", { timeout: 10000 });
  await page.click("#btn-selftest");
  await page.waitForSelector('#selftest-status[data-tone="success"], #selftest-status[data-tone="danger"]', { timeout: 30000 });
  return page.evaluate(() => ({
    status: document.querySelector("#selftest-status").textContent.trim(),
    tone: document.querySelector("#selftest-status").dataset.tone,
    title: document.querySelector("#diag-selftest h3").textContent.trim(),
    button: document.querySelector("#btn-selftest").textContent.trim(),
    groups: [...document.querySelectorAll("#selftest-results .selftest-group")].map((g) => ({
      id: g.dataset.group,
      heading: g.querySelector("h4").textContent.trim(),
      cases: [...g.querySelectorAll(".selftest-case")].map((c) => ({ id: c.dataset.case, result: c.dataset.result, label: c.textContent })),
      details: [...g.querySelectorAll(".selftest-detail")].map((d) => d.textContent.trim())
    }))
  }));
}

const server = await serveStatic(APP_ROOT, 8291);
const browser = await launchBrowser();
try {
  for (const lang of ["en", "de"]) {
    const { page, ctx, problems, csp } = await openApp(browser, server.base, { skipIntro: true, query: `?lang=${lang}` });
    const r = await runInPage(page);
    check(`${lang}: the section is called "${t("diag.selftest", {}, lang)}"`, r.title === t("diag.selftest", {}, lang));
    check(`${lang}: the button says "${t("selftest.run", {}, lang)}"`, plain(r.button) === t("selftest.run", {}, lang));
    check(`${lang}: the status says every case passed`, r.tone === "success" && plain(r.status) === plain(t("diag.selftest_passed", { n: String(total) }, lang)), r.status);
    check(`${lang}: three groups`, r.groups.map((g) => g.id).join() === "golden,audit,cluster", r.groups.map((g) => g.id).join());
    for (const g of r.groups) {
      check(`${lang}: group ${g.id} lists its fixture cases in order`, g.cases.map((c) => c.id).join() === ids[g.id]?.join(), g.cases.map((c) => c.id).join());
      check(`${lang}: every ${g.id} case passed`, g.cases.every((c) => c.result === "pass") && g.details.length === 0, g.cases.filter((c) => c.result !== "pass").map((c) => c.id).join());
      check(`${lang}: group ${g.id}'s heading is translated`, g.heading.startsWith(t(`diag.selftest_group.${g.id}`, {}, lang)), g.heading);
      check(`${lang}: each ${g.id} case says it passed in words`, g.cases.every((c) => c.label.includes(t("diag.case_pass", {}, lang))), g.cases[0]?.label);
    }
    check(`${lang}: no CSP violation`, (await csp()).length === 0, (await csp()).join("; "));
    check(`${lang}: no errors`, problems.length === 0, problems.join("; "));
    await ctx.close();
  }
  // A changed expectation on its way to the page: G1 must fail, with its values.
  {
    const { page, ctx } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=en" });
    await page.route("**/tests/fixtures/golden-cases.json", async (route) => {
      const body = json(FIXTURES.golden);
      body.golden_cases[0].expect.ea_annual_eur = 1220001;
      await route.fulfill({ status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    });
    const r = await runInPage(page);
    const golden = r.groups.find((g) => g.id === "golden");
    check("a changed fixture: the status says one case failed", r.tone === "danger" && plain(r.status) === plain(t("diag.selftest_failed", { failed: "1", n: String(total) }, "en")), r.status);
    check("a changed fixture: G1 shows as failed in words", golden?.cases.find((c) => c.id === "G1")?.result === "fail" && golden.cases.find((c) => c.id === "G1").label.includes(t("diag.case_fail", {}, "en")));
    check("a changed fixture: the failure names the field and both values", golden?.details.some((d) => d.includes("G1") && d.includes("ea_annual_eur") && d.includes("1220001") && d.includes("1220000")), golden?.details.join(" | "));
    check("a changed fixture: the other cases still pass", r.groups.flatMap((g) => g.cases).filter((c) => c.result === "fail").length === 1);
    await ctx.close();
  }
  // A fixture that cannot be loaded shows an error, not a pass.
  {
    const { page, ctx } = await openApp(browser, server.base, { skipIntro: true, query: "?lang=de" });
    await page.route("**/tests/fixtures/cluster-cases.json", (route) => route.fulfill({ status: 404, body: "missing" }));
    const r = await runInPage(page);
    check("a missing fixture: the status says the files could not be loaded", r.tone === "danger" && r.status.startsWith(plain(t("diag.selftest_error", { message: "§" }, "de")).split("§")[0]), r.status);
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (failed) { console.log(`${failed} of ${checks} checks failed.`); process.exit(1); }
console.log(`SELFTEST OK (${total} cases in ${BROWSER_NAME}, English and German, ${checks} checks)`);
