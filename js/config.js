// Central configuration. Every value here is documented and verified in TECH_NOTES.md.

export const APP = {
  id: "dr",
  name: "Duty Radar",
  fullName: "Duty Radar (Pflichten-Radar)",
  version: "1.0.0"
};

export const ANTHROPIC = {
  messagesUrl: "https://api.anthropic.com/v1/messages",
  modelsUrl: "https://api.anthropic.com/v1/models?limit=100",
  apiVersion: "2023-06-01",
  // Header that enables CORS for direct browser calls (verified by live probe, TECH_NOTES §3).
  browserHeader: "anthropic-dangerous-direct-browser-access",
  webSearchTool: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
  webSearchUsdPer1000: 10,
  // Spend limits are set per workspace (not per key, and not on the Default Workspace), so the
  // advice is: a dedicated workspace with a monthly spend limit, and a key scoped to it (TECH_NOTES §3).
  consoleKeysUrl: "https://platform.claude.com/settings/keys",
  consoleWorkspacesUrl: "https://platform.claude.com/settings/workspaces"
};

// Prices in USD per million tokens (TECH_NOTES §1, re-verified 19 Nov 2026). `probe` marks the cheap
// model Diagnostics uses for its one-off web-search test.
export const MODELS = [
  {
    id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Balanced. Recommended for the demo.",
    effort: "medium", maxTokens: 16000,
    price: { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.1 }
  },
  {
    id: "claude-haiku-5-5", label: "Haiku 5.5", hint: "Fastest and cheapest.", probe: true,
    effort: "medium", maxTokens: 12000,
    price: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01,
      longPrompt: { thresholdTokens: 100000, input: 0.5, output: 2.5, cacheWrite: 0.625, cacheRead: 0.05 } }
  },
  {
    id: "claude-opus-5-5", label: "Opus 5.5", hint: "Deepest reasoning, highest cost.",
    effort: "high", maxTokens: 16000,
    price: { input: 4.0, output: 20.0, cacheWrite: 5.0, cacheRead: 0.2 }
  }
];
export const DEFAULT_MODEL = "claude-sonnet-5-5";

// Run caps of the specification (40 model calls and €3 per run, orchestrator and sub-calls together),
// with the soft limit of PLAN.md P-3: from the soft limit on, the agent is asked to wrap up, and at the
// hard cap the run stops with the closing report from the template.
export const AGENT = {
  maxSteps: 40,          // model calls per run
  budgetEur: 3.0,        // no call starts once this is spent
  softSteps: 36,
  softBudgetEur: 2.7,
  idleTimeoutMs: 90000,  // no streamed data for this long counts as a failed request
  maxOutputTokens: 128000
};

// The run defaults of config/run.json (tests/unit.mjs checks that both agree); Assumptions & diagnostics
// can change them for one session.
export const RUN_DEFAULTS = Object.freeze({
  max_model_calls: 40,
  max_cost_eur: 3,
  orchestrator_model: "claude-sonnet-5-5",
  classifier_model: "claude-haiku-5-5",
  drafting_model: "claude-sonnet-5-5",
  orchestrator_effort: "medium",
  classifier_effort: "low",
  max_tokens_orchestrator: 16000,
  max_tokens_subcall: 8000
});

// ECB reference rate on 12 Oct 2026, as in the sister apps (the specification's 0.92 is replaced by
// the brief). Fixed for a stable cost meter; shown read-only in Assumptions & diagnostics.
export const FX_USD_EUR = 0.894;

// Storage keys: every key starts with "dr.", because GitHub Pages serves all of an account's project
// sites from one origin. Vici's "vc-theme" is the one shared key.
const P = `${APP.id}.`;
export const STORAGE = {
  apiKey: `${P}anthropic.key`,          // sessionStorage: this tab only
  sovereignKey: `${P}sovereign.key`,    // sessionStorage: the Sovereign endpoint's own key, never the Anthropic one
  lang: `${P}lang`,                     // localStorage: the chosen language
  introSeen: `${P}introSeen`,           // localStorage: the intro opens by itself only on a first visit
  consoleText: `${P}consoleText`,       // localStorage: larger console text for projectors
  model: `${P}model`,                   // sessionStorage
  speed: `${P}speed`,                   // sessionStorage
  audit: (runId) => `${P}audit.${runId}` // sessionStorage, best effort
};

// Files the app loads from its own site (the security policy allows 'self' only).
export const DATA = {
  i18n: { en: "js/i18n/en.json", de: "js/i18n/de.json" },
  corpusIndex: "data/corpus/index.json",
  slice: "config/slice.json"
};
