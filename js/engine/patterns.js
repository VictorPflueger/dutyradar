// Duty pattern matcher: finds duty candidates in a norm's sentences (pure; data passed in).
//
// Matching is case-insensitive with the u flag, and every pattern is wrapped in the boundaries
// (?<![\p{L}\p{N}]) and (?![\p{L}\p{N}]) instead of \b, which ignores umlauts. A sentence becomes a
// candidate when it contains a trigger and an obligation marker (hat, haben, ist, sind, muss,
// müssen, verpflichtet, obliegt); a noun trigger alone counts half its weight and still needs a
// marker. A self-marking pattern ("besteht Auskunftspflicht") carries its own marker, and an
// authority's duty stated in the present tense ("Die Bundesregierung evaluiert …") counts when an
// authority is named before the trigger. Candidate ids are D-<paragraph id>-<n>, n counting the
// paragraph's candidates in document order.

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";

/** Compiles the pattern file (data/patterns/duty-patterns.json). */
export function compilePatterns(file) {
  const patterns = file.patterns.map((p) => ({
    id: p.id,
    type: p.type,
    kind: p.kind,
    weight: (p.weight ?? 1) * (p.kind === "noun" ? 0.5 : 1),
    authority_present: Boolean(p.authority_present),
    self_marking: Boolean(p.self_marking),
    re: new RegExp(`${B}(?:${p.regex})${E}`, "giu")
  }));
  return {
    patterns,
    marker: new RegExp(`${B}(?:${file.markers.join("|")})${E}`, "giu"),
    authority: new RegExp(`${B}(?:${file.authorities})${E}`, "giu")
  };
}

/**
 * Matches one sentence. Returns { candidate, matches: [{ pattern_id, type, kind, weight, start,
 * end, phrase }], marker: { text, start } | null, score, type_hint, evidence } with offsets into the
 * sentence. The evidence is the strongest match, the earliest among equals.
 */
export function matchSentence(text, compiled) {
  const s = String(text ?? "");
  const matches = [];
  for (const p of compiled.patterns) {
    p.re.lastIndex = 0;
    for (const m of s.matchAll(p.re)) {
      matches.push({ pattern_id: p.id, type: p.type, kind: p.kind, weight: p.weight, start: m.index, end: m.index + m[0].length, phrase: m[0], authority_present: p.authority_present, self_marking: p.self_marking });
    }
  }
  compiled.marker.lastIndex = 0;
  const markerMatch = compiled.marker.exec(s);
  const marker = markerMatch ? { text: markerMatch[0], start: markerMatch.index } : null;
  compiled.authority.lastIndex = 0;
  const firstAuthority = compiled.authority.exec(s);
  const authorityBefore = (m) => Boolean(firstAuthority) && firstAuthority.index < m.start;
  const marked = (m) => Boolean(marker) || m.self_marking || (m.authority_present && authorityBefore(m));
  const usable = matches.filter(marked);
  const evidence = [...usable].sort((a, b) => b.weight - a.weight || a.start - b.start)[0] || null;
  const score = [...new Map(usable.map((m) => [m.pattern_id, m.weight])).values()].reduce((a, b) => a + b, 0);
  return {
    candidate: usable.length > 0,
    matches,
    marker: marker || (evidence && !marker ? { text: evidence.phrase, start: evidence.start, self: true } : null),
    score,
    type_hint: evidence ? evidence.type : null,
    evidence
  };
}

/**
 * Candidates of a norm: [{ candidate_id, sentence_id, paragraph_id, pattern_ids, type_hint, marker,
 * score, span: { sentence_id, start, end, phrase } }], spans as offsets into the paragraph text.
 */
export function extractCandidates(norm, compiled) {
  const out = [];
  for (const p of norm.paragraphs || []) {
    let n = 0;
    for (const s of p.sentences || []) {
      const text = p.text.slice(s.start, s.end);
      const r = matchSentence(text, compiled);
      if (!r.candidate) continue;
      n += 1;
      out.push({
        candidate_id: `D-${p.id}-${n}`,
        sentence_id: s.id,
        paragraph_id: p.id,
        norm_id: norm.id,
        pattern_ids: [...new Set(r.matches.map((m) => m.pattern_id))],
        type_hint: r.type_hint,
        marker: r.marker.text,
        score: r.score,
        span: { sentence_id: s.id, start: s.start + r.evidence.start, end: s.start + r.evidence.end, phrase: r.evidence.phrase }
      });
    }
  }
  return out;
}
