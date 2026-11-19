// Law snapshot: builds data/corpus/ from gesetze-im-internet.de for the slice in config/slice.json.
//
//   1. Reads the slice ({ slug, expected_title } per norm).
//   2. Downloads the daily table of contents gii-toc.xml and matches each slug to the item whose link
//      ends in /<slug>/xml.zip. A missing slug or a title that differs (after collapsing white space)
//      stops the script.
//   3. Downloads and unzips each norm's xml.zip and parses it strictly (validated XML, gii-norm.dtd 1.01).
//   4. Writes one Norm file per law: paragraphs with id, enbez, title, plain text (Absatz markers kept),
//      footnotes apart, sentences and the HTML link; eu_basis from the footnote "Amtlicher Hinweis des
//      Normgebers auf EG-Recht"; then data/corpus/index.json and SNAPSHOT.md.
//   5. Checks every paragraph link with a HEAD request; a link that fails falls back to the norm's index
//      page, and every fallback is logged.
//
// Usage: node tools/snapshot-laws.mjs                         full run (network)
//        node tools/snapshot-laws.mjs --raw-only --raw-out raw/   download only, keep the raw files
//        node tools/snapshot-laws.mjs --from raw/             build from raw files (no network, links unchecked)
// Options: --slice <file> --toc <file> --out <dir> --snapshot-md <file> --raw-out <dir> --no-links
// This environment's build shell cannot reach the host; the snapshot runs in GitHub Actions
// (.github/workflows/snapshot.yml, TECH_NOTES §5).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { splitSentences } from "../js/engine/sentences.js";

export const HOST = "https://www.gesetze-im-internet.de";
export const TOC_URL = `${HOST}/gii-toc.xml`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Collapses white space the way titles are compared. */
export const normTitle = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export class SnapshotError extends Error {}

/** gii-toc.xml → [{ title, link, slug }]. Rejects malformed XML. */
export function parseToc(xml) {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new SnapshotError(`gii-toc.xml is not well-formed: ${valid.err?.msg} (line ${valid.err?.line})`);
  const doc = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "item", parseTagValue: false, trimValues: true }).parse(xml);
  const items = doc?.items?.item || [];
  return items.map((it) => {
    const link = String(it.link ?? "").trim();
    const m = link.match(/\/([^/]+)\/xml\.zip$/);
    return { title: String(it.title ?? ""), link, slug: m ? m[1] : null };
  });
}

/**
 * Matches every slug of the slice; throws on a missing slug or a title mismatch. With
 * { lenient: true } (raw downloads only) it returns the problems instead, with every slug it found.
 */
export function resolveSlice(norms, tocItems, { lenient = false } = {}) {
  const bySlug = new Map(tocItems.filter((i) => i.slug).map((i) => [i.slug, i]));
  const problems = [];
  const resolved = [];
  for (const n of norms) {
    const item = bySlug.get(n.slug);
    if (!item) { problems.push(`slug "${n.slug}" is not in gii-toc.xml`); continue; }
    if (normTitle(item.title) !== normTitle(n.expected_title)) {
      problems.push(`title of "${n.slug}" differs: gii-toc.xml has "${normTitle(item.title)}", config/slice.json expects "${normTitle(n.expected_title)}"`);
      if (!lenient) continue;
    }
    resolved.push({ ...n, toc_title: item.title, link: item.link });
  }
  if (lenient) return { resolved, problems };
  if (problems.length) throw new SnapshotError(`Slice does not match gii-toc.xml:\n  - ${problems.join("\n  - ")}`);
  return resolved;
}

// ---- norm XML ------------------------------------------------------------------------------------

const BLOCK = new Set(["P", "DT", "DD", "LA", "row", "entry", "title", "Title", "TOC", "pre", "table", "tgroup", "tbody", "thead"]);

/** Flattens a preserveOrder node list to text; block elements end in a line break. */
function flatten(nodes, out = []) {
  for (const node of nodes || []) {
    for (const [tag, value] of Object.entries(node)) {
      if (tag === ":@") continue;
      if (tag === "#text") { out.push(String(value)); continue; }
      if (tag === "BR") { out.push("\n"); continue; }
      if (tag === "FnR" || tag === "FnArea" || tag === "img" || tag === "IMG") continue;
      flatten(value, out);
      if (BLOCK.has(tag)) out.push("\n");
    }
  }
  return out;
}

/** Plain text of an element's children: entities decoded, white space tidied, line breaks kept. */
export function textOf(nodes) {
  return flatten(nodes).join("")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const child = (nodes, tag) => (nodes || []).find((n) => tag in n)?.[tag];
const children = (nodes, tag) => (nodes || []).filter((n) => tag in n).map((n) => n[tag]);
const attrs = (nodes, tag) => (nodes || []).find((n) => tag in n)?.[":@"] || {};

/** CELEX numbers named in the "Amtlicher Hinweis des Normgebers auf EG-Recht" (empty without one). */
export function euBasisFromText(text) {
  const s = String(text || "");
  const at = s.search(/Amtlicher Hinweis des Normgebers auf EG-Recht/i);
  if (at < 0) return [];
  // The hint runs until the closing "+++)" of its block.
  const end = s.indexOf("+++)", at);
  const hint = s.slice(at, end > at ? end : undefined);
  return [...new Set([...hint.matchAll(/CELEX[- ]Nr\.?:?\s*([0-9]{5}[A-Z][0-9]{4}(?:\([0-9]+\))?)/gi)].map((m) => m[1]))];
}

/** "§ 14a" → { kind: "p", nr: "14a" }; "Art 3" → { kind: "art", nr: "3" }; anything else → null. */
export function parseEnbez(enbez) {
  const s = normTitle(enbez);
  let m = s.match(/^§§?\s*([0-9]+[a-z]?)\b/i);
  if (m) return { kind: "p", nr: m[1].toLowerCase(), label: s };
  m = s.match(/^Art\.?\s*([0-9]+[a-z]?)\b/i);
  if (m) return { kind: "art", nr: m[1].toLowerCase(), label: s };
  return null;
}

export const paragraphId = (slug, ref) => `${slug}-${ref.kind === "p" ? "p" : "art"}${ref.nr}`;
export const paragraphUrl = (slug, ref) => `${HOST}/${slug}/${ref.kind === "p" ? `__${ref.nr}` : `art_${ref.nr}`}.html`;

/**
 * One norm's XML → the specification's Norm contract (without retrieval time, which the caller sets).
 * meta: { slug, link }. Paragraphs are the norm elements whose enbez is a § or an Art.; structure
 * headings, annexes and repealed paragraphs are counted, not kept.
 */
export function parseNormXml(xml, meta) {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) throw new SnapshotError(`${meta.slug}: XML is not well-formed: ${valid.err?.msg} (line ${valid.err?.line})`);
  const ordered = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "", parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true, htmlEntities: true }).parse(xml);
  const dokumente = child(ordered, "dokumente");
  if (!dokumente) throw new SnapshotError(`${meta.slug}: no <dokumente> root`);
  const rootAttrs = attrs(ordered, "dokumente");
  const norms = children(dokumente, "norm");
  if (!norms.length) throw new SnapshotError(`${meta.slug}: no <norm> element`);

  const head = norms[0];
  const headMeta = child(head, "metadaten");
  const abbr = textOf(child(headMeta, "amtabk") || child(headMeta, "jurabk"));
  const longTitle = textOf(child(headMeta, "langue"));
  const shortTitle = textOf(child(headMeta, "kurzue"));
  const headText = textOf(child(head, "textdaten"));

  const paragraphs = [];
  const skipped = { structure: 0, annex: 0, repealed: 0, other: 0 };
  let euText = headText;
  for (const norm of norms.slice(1)) {
    const md = child(norm, "metadaten");
    const enbez = textOf(child(md, "enbez"));
    const td = child(norm, "textdaten");
    const fussnoten = textOf(child(td, "fussnoten"));
    euText += `\n${fussnoten}`;
    if (!enbez) { if (child(md, "gliederungseinheit")) skipped.structure += 1; else skipped.other += 1; continue; }
    const ref = parseEnbez(enbez);
    if (!ref) { if (/^Anlage|^Anhang|^Muster/i.test(enbez)) skipped.annex += 1; else skipped.other += 1; continue; }
    const title = textOf(child(md, "titel"));
    const text = textOf(child(child(td, "text"), "Content") || child(td, "text"));
    if (!text || /^\(?weggefallen\)?$/i.test(text) || /^\(weggefallen\)$/i.test(title) || text === "-") { skipped.repealed += 1; continue; }
    const id = paragraphId(meta.slug, ref);
    if (paragraphs.some((p) => p.id === id)) throw new SnapshotError(`${meta.slug}: two paragraphs with the id ${id}`);
    const sentences = splitSentences(text).map((s, i) => ({ id: `${id}-s${i + 1}`, start: s.start, end: s.end }));
    paragraphs.push({ id, enbez: ref.label, title, text, footnotes: fussnoten ? [fussnoten] : [], html_url: paragraphUrl(meta.slug, ref), sentences });
  }
  return {
    id: meta.slug,
    abbr: abbr || meta.short || meta.slug,
    title: longTitle || shortTitle || meta.expected_title || meta.slug,
    slug: meta.slug,
    source_xml_url: meta.link || `${HOST}/${meta.slug}/xml.zip`,
    html_url: `${HOST}/${meta.slug}/index.html`,
    builddate: rootAttrs.builddate || norms.map((n) => attrs(n, "metadaten").builddate).find(Boolean) || null,
    retrieved_at: null,
    eu_basis: euBasisFromText(euText),
    paragraphs,
    skipped
  };
}

// ---- network and files -------------------------------------------------------------------------------

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchBytes(url) {
  const res = await fetch(url, { headers: { "user-agent": "dutyradar-snapshot (GitHub Actions)" } });
  if (!res.ok) throw new SnapshotError(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  }
}

/** The single XML file of a norm's archive. */
export function xmlFromZip(bytes, slug) {
  const files = unzipSync(new Uint8Array(bytes));
  const names = Object.keys(files);
  const xmlNames = names.filter((n) => n.toLowerCase().endsWith(".xml"));
  if (xmlNames.length !== 1) throw new SnapshotError(`${slug}: the archive holds ${xmlNames.length} XML files (${names.join(", ")})`);
  return { xml: Buffer.from(files[xmlNames[0]]).toString("utf8"), name: xmlNames[0], entries: names };
}

function args(argv) {
  const o = { links: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raw-only") o.rawOnly = true;
    else if (a === "--no-links") o.links = false;
    else if (["--from", "--slice", "--toc", "--out", "--snapshot-md", "--raw-out"].includes(a)) o[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else throw new SnapshotError(`Unknown option ${a}`);
  }
  return o;
}

export async function run(argv = process.argv.slice(2), log = console.log) {
  const o = args(argv);
  const slicePath = path.resolve(ROOT, o.slice || "config/slice.json");
  const slice = JSON.parse(await readFile(slicePath, "utf8"));
  const norms = Array.isArray(slice) ? slice : slice.norms;
  const startedAt = new Date().toISOString();
  const offline = Boolean(o.from);

  // 1–2. Table of contents and slice.
  const tocBytes = o.toc ? await readFile(path.resolve(o.toc)) : offline ? await readFile(path.join(o.from, "gii-toc.xml")) : await fetchBytes(TOC_URL);
  const toc = parseToc(tocBytes.toString("utf8"));
  let resolved;
  if (o.rawOnly) {
    const r = resolveSlice(norms, toc, { lenient: true });
    resolved = r.resolved;
    for (const p of r.problems) log(`  slice problem (kept for inspection): ${p}`);
    log(`gii-toc.xml: ${toc.length} items; ${resolved.length} of ${norms.length} slugs found.`);
  } else {
    resolved = resolveSlice(norms, toc);
    log(`gii-toc.xml: ${toc.length} items; all ${resolved.length} norms of the slice found with their titles.`);
  }
  if (o.rawOut) {
    await mkdir(o.rawOut, { recursive: true });
    await writeFile(path.join(o.rawOut, "gii-toc.xml"), tocBytes);
  }

  // 3. Archives.
  const manifest = { toc: { url: TOC_URL, sha256: sha256(tocBytes), bytes: tocBytes.length, items: toc.length, fetched_at: startedAt }, norms: [] };
  const corpus = [];
  for (const n of resolved) {
    let xml;
    let entries = [];
    let zipSha = null;
    if (offline && existsSync(path.join(o.from, `${n.slug}.xml`))) {
      xml = await readFile(path.join(o.from, `${n.slug}.xml`), "utf8");
    } else {
      const zip = offline ? await readFile(path.join(o.from, `${n.slug}.zip`)) : await fetchBytes(n.link.replace(/^http:/, "https:"));
      zipSha = sha256(zip);
      const out = xmlFromZip(zip, n.slug);
      xml = out.xml;
      entries = out.entries;
    }
    manifest.norms.push({ slug: n.slug, zip_sha256: zipSha, xml_sha256: sha256(Buffer.from(xml)), entries });
    if (o.rawOut) await writeFile(path.join(o.rawOut, `${n.slug}.xml`), xml);
    if (o.rawOnly) { log(`  ${n.slug}: ${xml.length} characters kept raw`); continue; }
    const norm = parseNormXml(xml, n);
    norm.retrieved_at = startedAt;
    corpus.push(norm);
    log(`  ${n.slug}: ${norm.abbr}, ${norm.paragraphs.length} paragraphs, ${norm.paragraphs.reduce((k, p) => k + p.sentences.length, 0)} sentences${norm.eu_basis.length ? `, EU basis ${norm.eu_basis.join(" ")}` : ""}`);
  }
  if (o.rawOut) await writeFile(path.join(o.rawOut, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (o.rawOnly) return { manifest };

  // 5. Links.
  const fallbacks = [];
  let checked = 0;
  if (o.links && !offline) {
    for (const norm of corpus) {
      for (const p of norm.paragraphs) {
        checked += 1;
        if (!(await headOk(p.html_url))) { fallbacks.push(`${p.id}: ${p.html_url}`); p.html_url = norm.html_url; }
      }
    }
    for (const f of fallbacks) log(`  link fallback: ${f}`);
  }

  // 4 and 6. Files.
  const outDir = path.resolve(ROOT, o.out || "data/corpus");
  await mkdir(outDir, { recursive: true });
  for (const norm of corpus) await writeFile(path.join(outDir, `${norm.slug}.json`), `${JSON.stringify(norm, null, 1)}\n`);
  const index = {
    slice_id: slice.slice_id || null,
    retrieved_at: startedAt,
    source: TOC_URL,
    toc_sha256: manifest.toc.sha256,
    links: o.links && !offline ? { checked, fallbacks: fallbacks.length } : { checked: 0, fallbacks: 0, note: "not checked" },
    norms: corpus.map((n, i) => ({
      id: n.id, slug: n.slug, abbr: n.abbr, title: n.title, toc_title: resolved[i].toc_title, family: resolved[i].family || null,
      builddate: n.builddate, paragraphs: n.paragraphs.length, sentences: n.paragraphs.reduce((k, p) => k + p.sentences.length, 0),
      eu_basis: n.eu_basis, xml_sha256: manifest.norms[i].xml_sha256, skipped: n.skipped
    }))
  };
  await writeFile(path.join(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(path.resolve(ROOT, o.snapshotMd || "SNAPSHOT.md"), snapshotMarkdown(index, fallbacks));
  log(`Wrote ${corpus.length} norms to ${path.relative(ROOT, outDir)}/ and ${o.snapshotMd || "SNAPSHOT.md"}.`);
  return { index, fallbacks };
}

/** SNAPSHOT.md: sources, dates and counts of the bundled corpus. */
export function snapshotMarkdown(index, fallbacks = []) {
  const total = (k) => index.norms.reduce((s, n) => s + n[k], 0);
  const lines = [
    "# SNAPSHOT — the bundled law texts",
    "",
    `Generated by \`tools/snapshot-laws.mjs\` on ${index.retrieved_at} from ${index.source} (SHA-256 \`${index.toc_sha256.slice(0, 16)}…\`). The texts are the consolidated versions of gesetze-im-internet.de, free to use and reuse; they are not the official version, which is the Federal Law Gazette (Bundesgesetzblatt).`,
    "",
    `Slice \`${index.slice_id}\`: ${index.norms.length} norms, ${total("paragraphs")} paragraphs, ${total("sentences")} sentences. Paragraph links: ${index.links.note ? index.links.note : `${index.links.checked} checked, ${index.links.fallbacks} fell back to the norm's index page`}.`,
    "",
    "| Slug | Abbreviation | Build date | Paragraphs | Sentences | EU basis (CELEX) | Not kept (structure, annex, repealed, other) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...index.norms.map((n) => `| \`${n.slug}\` | ${n.abbr} | ${n.builddate ?? "–"} | ${n.paragraphs} | ${n.sentences} | ${n.eu_basis.length ? n.eu_basis.join(", ") : "–"} | ${n.skipped.structure}, ${n.skipped.annex}, ${n.skipped.repealed}, ${n.skipped.other} |`),
    ""
  ];
  if (fallbacks.length) lines.push("Link fallbacks:", "", ...fallbacks.map((f) => `- ${f}`), "");
  return `${lines.join("\n")}\n`.replace(/\n{3,}$/, "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => {
    console.error(e instanceof SnapshotError ? `Snapshot stopped: ${e.message}` : e);
    process.exit(1);
  });
}
