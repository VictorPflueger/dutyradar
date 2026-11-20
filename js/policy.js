// The specification's content security policy (PLAN.md C24), in one place: tools/set-csp.mjs writes it
// into index.html, tools/check-static.mjs checks the file, and Assumptions & diagnostics checks the
// policy the page actually carries against it. Pure: no DOM, no storage, no fetch.

export const POLICY = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.anthropic.com SOVEREIGN_ORIGIN; base-uri 'self'; form-action 'none'; object-src 'none'";

/** The policy for a sovereign configuration: its origin, or nothing when it is disabled or empty. */
export function policyFor(sovereign) {
  let origin = "";
  if (sovereign?.enabled && sovereign.base_url) {
    const u = new URL(sovereign.base_url);
    if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") throw new Error(`The sovereign endpoint must use https: ${sovereign.base_url}`);
    origin = u.origin;
  }
  return POLICY.replace(" SOVEREIGN_ORIGIN", origin ? ` ${origin}` : "");
}
