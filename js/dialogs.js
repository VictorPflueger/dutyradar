// The dialogs of the control bar: "How it works" (the intro, on a first visit by itself), the mode dialog
// that Start agent opens (Simulation; Live with the key; Sovereign with its status, disabled while no
// endpoint is configured) and the key dialog. The key is checked with the free GET /v1/models before a
// Live run starts; it stays in this tab's session storage, is shown masked and never enters an export,
// the audit or a recording.

import { h } from "./dom.js";
import { icon } from "./icons.js";
import { t, lang } from "./i18n.js";
import { openModal } from "./modal.js";
import { STORAGE, RUN_DEFAULTS, ANTHROPIC } from "./config.js";
import { formatCount, formatEur } from "./engine/format.js";
import { getKey, setKey, forgetKey, looksLikeKey, maskKey } from "./keystore.js";
import { checkKey, networkMessage } from "./anthropic.js";
import { sovereignStatus } from "./llm/openai-compat.js";

export function openIntro() {
  const { close } = openModal({
    title: t("intro.title"),
    intro: t("start.question"),
    size: "intro",
    className: "intro-modal",
    body: [h("ol", { class: "intro-steps" }, ["inventory", "duplicates", "prices", "decision"].map((k) => h("li", {}, t(`intro.step.${k}`)))),
      h("p", { class: "intro-disclosure" }, t("disclosure.ai"), " ", t("disclosure.proto"))],
    footer: [h("button", { class: "vc-button", type: "button", autofocus: true, on: { click: () => close() } }, t("intro.close"))],
    onClose: () => { try { localStorage.setItem(STORAGE.introSeen, "1"); } catch { /* storage blocked */ } }
  });
}

let keyAccepted = false; // the stored key passed GET /v1/models in this page

/** The mode tags, as the header's mode badge draws them: neutral tape, solid merlot, lilac. */
const TAG = {
  simulation: "vc-tag mode-tag mode-tag--simulation",
  live: "vc-tag vc-tag--accent vc-tag--solid mode-tag",
  sovereign: "vc-tag vc-tag--feature mode-tag"
};

/**
 * The mode dialog. opts: { runId, norms (names of the norms a Live run reads), sovereign (config or
 * null), onStart({ mode }) }.
 */
export function openModeDialog({ runId, norms, sovereign, onStart }) {
  const l = lang();
  const sov = sovereignStatus(sovereign);
  const card = (mode, title, text, extra, action, { disabled = false, reason = "" } = {}) =>
    h("section", { class: "vc-card mode-card", dataset: { mode, disabled: String(disabled) }, "aria-labelledby": `mode-${mode}-title` },
      h("h3", { id: `mode-${mode}-title` }, h("span", { class: TAG[mode] }, t(`mode.${mode}`)), " ", title),
      h("p", {}, text),
      extra,
      disabled ? h("p", { class: "mode-reason", id: `mode-${mode}-reason` }, icon("info", 16), reason) : null,
      action);
  const startButton = (mode, label, { disabled = false, reasonId = null } = {}) => {
    const b = h("button", { type: "button", class: mode === "simulation" ? "vc-button" : "vc-button vc-button--outline", id: `start-${mode}`, disabled, "aria-describedby": reasonId });
    b.append(icon("play", 18), h("span", {}, label));
    return b;
  };

  const simBtn = startButton("simulation", t("mode.simulation_start"));
  const liveBtn = startButton("live", t("mode.live_start"));
  const sovBtn = startButton("sovereign", t("mode.sovereign_start"), { disabled: !sov.enabled, reasonId: sov.enabled ? null : "mode-sovereign-reason" });
  const keyLine = h("p", { class: "mode-key" }, icon("key", 16), " ", keyAccepted && getKey() ? t("mode.live_key_ok", { key: maskKey() }) : t("mode.live_key_needed"));
  const { close } = openModal({
    title: t("mode.dialog_title"),
    intro: t("mode.dialog_lead", { run: t(`run.${runId}`) }),
    size: "wide",
    className: "mode-modal",
    body: [h("div", { class: "mode-cards" },
      card("simulation", t("mode.simulation_title"), t("mode.simulation_text"), null, simBtn),
      card("live", t("mode.live_title"), t("mode.live_text", { calls: formatCount(RUN_DEFAULTS.max_model_calls, l), eur: formatEur(RUN_DEFAULTS.max_cost_eur, l) }),
        h("div", {}, h("p", { class: "mode-norms" }, t("mode.live_norms", { norms })), keyLine), liveBtn),
      card("sovereign", t("mode.sovereign_title"), t("mode.sovereign_text"), sov.enabled ? h("p", {}, t("mode.sovereign_ready", { label: sovereign.label || sovereign.base_url })) : null, sovBtn,
        { disabled: !sov.enabled, reason: sov.enabled ? "" : t(sov.reason) }))],
    footer: [h("button", { type: "button", class: "vc-button vc-button--ghost", on: { click: () => close() } }, t("mode.cancel"))]
  });
  simBtn.addEventListener("click", () => { close(); onStart({ mode: "simulation" }); });
  liveBtn.addEventListener("click", () => {
    close();
    if (keyAccepted && getKey()) onStart({ mode: "live" });
    else openKeyDialog({ onAccepted: () => onStart({ mode: "live" }) });
  });
  sovBtn.addEventListener("click", () => {
    if (!sov.enabled) return;
    close();
    if (sovereign.requires_key && !getKey()) openKeyDialog({ variant: "sovereign", onAccepted: () => onStart({ mode: "sovereign" }) });
    else onStart({ mode: "sovereign" });
  });
}

/** The key dialog: paste, check with GET /v1/models, start. variant "sovereign" stores without the check. */
export function openKeyDialog({ onAccepted, variant = "anthropic" }) {
  const input = h("input", { class: "vc-input key-input", id: "api-key", type: "password", autocomplete: "off", spellcheck: "false", "aria-describedby": "key-msg key-privacy" });
  const stored = getKey();
  if (stored) input.placeholder = maskKey(stored);
  const show = h("button", { type: "button", class: "vc-icon-button", "aria-label": t("key.show"), "aria-pressed": "false" }, icon("eye", 18));
  show.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    show.setAttribute("aria-pressed", String(!visible));
    show.setAttribute("aria-label", t(visible ? "key.show" : "key.hide"));
    show.replaceChildren(icon(visible ? "eye" : "eyeOff", 18));
  });
  const msg = h("p", { class: "key-msg", id: "key-msg", role: "status", "aria-live": "polite" });
  const check = h("button", { type: "button", class: "vc-button", id: "key-check" }, icon("key", 18), h("span", {}, t("key.check")));
  const forget = h("button", { type: "button", class: "vc-button vc-button--ghost", id: "key-forget", hidden: !stored }, t("key.forget"));
  const { close } = openModal({
    title: t(variant === "sovereign" ? "key.title_sovereign" : "key.title"),
    intro: t(variant === "sovereign" ? "key.lead_sovereign" : "key.lead"),
    className: "key-modal",
    body: [
      h("label", { class: "vc-field" }, h("span", { class: "vc-label" }, t("key.label")), h("span", { class: "key-row" }, input, show)),
      msg,
      h("p", { class: "key-privacy", id: "key-privacy" }, icon("shield", 16), t("key.privacy")),
      variant === "anthropic" ? h("p", { class: "key-spend" }, t("key.spend"), " ", h("a", { href: ANTHROPIC.consoleWorkspacesUrl, target: "_blank", rel: "noopener noreferrer" }, t("key.workspaces"))) : null
    ],
    footer: [forget, h("button", { type: "button", class: "vc-button vc-button--ghost", on: { click: () => close() } }, t("mode.cancel")), check]
  });
  const say = (text, tone = "") => { msg.textContent = text; msg.dataset.tone = tone; };
  forget.addEventListener("click", () => { forgetKey(); keyAccepted = false; input.placeholder = ""; forget.hidden = true; say(t("key.forgotten")); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") check.click(); });
  check.addEventListener("click", async () => {
    const raw = input.value.trim() || getKey() || "";
    if (variant === "sovereign") {
      if (!raw) { say(t("key.empty"), "danger"); return; }
      setKey(raw); input.value = "";
      close(); onAccepted(); return;
    }
    if (!looksLikeKey(raw)) { say(t("key.format"), "danger"); return; }
    check.disabled = true;
    say(t("key.checking"));
    let res;
    try { res = await checkKey(raw); } catch (e) { res = { ok: false, status: 0, error: { message: networkMessage(e) } }; }
    check.disabled = false;
    if (!res.ok) {
      keyAccepted = false;
      say(res.status === 401 || res.status === 403 ? t("key.rejected_detail", { status: res.status }) : t("notice.network", { message: res.error?.message || String(res.status) }), "danger");
      return;
    }
    setKey(raw);
    input.value = "";
    keyAccepted = true;
    close();
    onAccepted();
  });
}

/** Forget that the key was accepted (a 401 during a run removed it). */
export function keyRejected() { keyAccepted = false; }
