// The record ids of data/story.js, for Vici's names-not-ids check (recordIdProblems): the values of id,
// duty, norm and option, the lists of duties and laws, and the fact and citation ids inside the agent's
// templates. A family whose id is a word of its own name ("statistics" in "Business statistics", "trade"
// in "Trade regulation") is that name, not a code, so its id stays out; it would match the plain word.

/** Every record id in the story data, three characters or longer. */
export function recordIds(D) {
  const ids = new Set();
  const visit = (x, key) => {
    if (Array.isArray(x)) {
      for (const v of x) {
        if (typeof v === "string" && ["removes", "covers", "norms"].includes(key)) ids.add(v);
        else visit(v, key);
      }
    } else if (x && typeof x === "object") {
      for (const [k, v] of Object.entries(x)) {
        if (["id", "duty", "norm", "option"].includes(k) && typeof v === "string") ids.add(v);
        visit(v, k);
      }
    } else if (typeof x === "string") {
      for (const m of x.matchAll(/\{\{(?:fact|cite):([^}]+)\}\}/g)) ids.add(m[1]);
    }
  };
  visit(D);
  for (const f of D.families) {
    const words = `${f.en} ${f.de}`.toLowerCase().split(/[^\p{L}]+/u);
    if (/^[a-z]+$/.test(f.id) && words.includes(f.id)) ids.delete(f.id);
  }
  return [...ids].filter((id) => id.trim().length >= 3);
}
