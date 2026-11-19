// The Norm contract of the specification's data model, as a list of problems (empty when a Norm file
// satisfies it). Used by tests/snapshot.mjs and tools/check-data.mjs.
const isStr = (v) => typeof v === "string";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function normProblems(norm, { slug } = {}) {
  const p = [];
  const need = (obj, keys, where) => { for (const k of keys) if (!(k in obj)) p.push(`${where}: missing "${k}"`); };
  if (!norm || typeof norm !== "object") return ["not an object"];
  need(norm, ["id", "abbr", "title", "slug", "source_xml_url", "html_url", "builddate", "retrieved_at", "eu_basis", "paragraphs"], "norm");
  if (slug && norm.slug !== slug) p.push(`norm: slug "${norm.slug}" is not "${slug}"`);
  if (norm.id !== norm.slug) p.push(`norm: id "${norm.id}" differs from slug "${norm.slug}"`);
  for (const k of ["abbr", "title"]) if (!isStr(norm[k]) || !norm[k].trim()) p.push(`norm: ${k} is empty`);
  if (!/^https:\/\/www\.gesetze-im-internet\.de\/[^/]+\/xml\.zip$/.test(norm.source_xml_url || "")) p.push(`norm: source_xml_url "${norm.source_xml_url}"`);
  if (norm.html_url !== `https://www.gesetze-im-internet.de/${norm.slug}/index.html`) p.push(`norm: html_url "${norm.html_url}"`);
  if (norm.builddate !== null && !/^\d{14}$/.test(String(norm.builddate))) p.push(`norm: builddate "${norm.builddate}"`);
  if (!ISO.test(norm.retrieved_at || "")) p.push(`norm: retrieved_at "${norm.retrieved_at}"`);
  if (!Array.isArray(norm.eu_basis) || norm.eu_basis.some((c) => !/^\d{5}[A-Z]\d{4}(?:\(\d+\))?$/.test(c))) p.push(`norm: eu_basis ${JSON.stringify(norm.eu_basis)}`);
  if (!Array.isArray(norm.paragraphs) || !norm.paragraphs.length) { p.push("norm: no paragraphs"); return p; }
  const ids = new Set();
  for (const para of norm.paragraphs) {
    const w = `paragraph ${para.id}`;
    need(para, ["id", "enbez", "title", "text", "footnotes", "html_url", "sentences"], w);
    if (!new RegExp(`^${norm.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(?:p|art)[0-9]+[a-z]?$`).test(para.id || "")) p.push(`${w}: id does not follow <slug>-p<nr>`);
    if (ids.has(para.id)) p.push(`${w}: duplicate id`);
    ids.add(para.id);
    if (!/^(?:§|Art)\s?\S/.test(para.enbez || "")) p.push(`${w}: enbez "${para.enbez}"`);
    if (!isStr(para.title)) p.push(`${w}: title is not text`);
    if (!isStr(para.text) || !para.text.trim()) p.push(`${w}: empty text`);
    if (!Array.isArray(para.footnotes) || para.footnotes.some((f) => !isStr(f))) p.push(`${w}: footnotes`);
    const nr = String(para.id).replace(/^.*-(?:p|art)/, "");
    const url = para.id.includes("-art") && /-art[0-9]/.test(para.id) ? `/${norm.slug}/art_${nr}.html` : `/${norm.slug}/__${nr}.html`;
    if (para.html_url !== `https://www.gesetze-im-internet.de${url}` && para.html_url !== norm.html_url) p.push(`${w}: html_url "${para.html_url}"`);
    if (!Array.isArray(para.sentences) || !para.sentences.length) { p.push(`${w}: no sentences`); continue; }
    let last = 0;
    para.sentences.forEach((s, i) => {
      if (s.id !== `${para.id}-s${i + 1}`) p.push(`${w}: sentence id "${s.id}" should be ${para.id}-s${i + 1}`);
      if (!(Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= last && s.end > s.start && s.end <= para.text.length)) p.push(`${w}: sentence ${s.id} offsets ${s.start}–${s.end}`);
      else if (para.text.slice(s.start, s.end).trim() !== para.text.slice(s.start, s.end)) p.push(`${w}: sentence ${s.id} has outer white space`);
      last = s.end;
    });
  }
  return p;
}
