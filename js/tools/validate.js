// Validates a tool input against its strict JSON Schema: the subset strict tools may use (type, enum,
// properties, required, additionalProperties false, items, minItems 0 or 1). Returns English messages
// the model can act on, empty when the input is valid. Pure; runs in the browser and under Node.

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const fits = (v, t) => t === typeOf(v) || (t === "number" && typeof v === "number") || (t === "integer" && Number.isInteger(v));
const article = (t) => (/^[aeiou]/.test(t) ? "an" : "a");
/** "duty_ids" → "duty id", "option_ids" → "option id", anything else → "item". */
const itemNoun = (name) => (/_ids$/.test(name) ? `${name.replace(/_ids$/, "").replace(/_/g, " ")} id` : "item");

export function validate(schema, value, name = "input") {
  const errors = [];
  walk(schema, value, name, errors);
  return errors;
}

function walk(s, v, name, errors) {
  if (!s || typeof s !== "object") return;
  const types = [].concat(s.type || []);
  if (types.length && !types.some((t) => fits(v, t))) {
    const wanted = types.filter((t) => t !== "null");
    errors.push(`${name} must be ${article(wanted[0] || "value")} ${wanted.join(" or ")}${types.includes("null") ? " or null" : ""}.`);
    return;
  }
  if (s.enum && !s.enum.some((e) => e === v)) {
    const opts = s.enum.filter((e) => e !== null);
    errors.push(`${name} must be one of ${opts.join(", ")}${s.enum.includes(null) ? ", or null" : ""}.`);
    return;
  }
  if (v === null) return;
  if (typeOf(v) === "array") {
    if (s.minItems === 1 && v.length === 0) errors.push(`${name} needs at least one ${itemNoun(name.split(".").pop())}.`);
    if (s.items) v.forEach((x, i) => walk(s.items, x, `${name}[${i}]`, errors));
    return;
  }
  if (typeOf(v) === "object" && (s.properties || s.additionalProperties === false)) {
    const props = s.properties || {};
    for (const r of s.required || []) if (!(r in v)) errors.push(`${name === "input" ? r : `${name}.${r}`} is required.`);
    for (const k of Object.keys(v)) {
      const path = name === "input" ? k : `${name}.${k}`;
      if (!(k in props)) {
        if (s.additionalProperties === false) errors.push(`Unknown field ${path}; allowed fields: ${Object.keys(props).join(", ") || "none"}.`);
        continue;
      }
      walk(props[k], v[k], path, errors);
    }
  }
}
