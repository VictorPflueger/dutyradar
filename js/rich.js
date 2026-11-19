// Model text on screen: placeholders become nodes. {{fact:ID}} is a button with the figure that opens
// "Where does this figure come from?"; {{cite:ID}} is a link to the paragraph on
// gesetze-im-internet.de. The figures render in the language of the text they stand in.

import { h } from "./dom.js";
import { placeholderParts, factText, citeText } from "./placeholders.js";
import { openFactDetails } from "./popovers.js";

/** A fragment for a text with placeholders; ctx: { state, data, lang }. */
export function richText(text, ctx) {
  const frag = document.createDocumentFragment();
  for (const p of placeholderParts(text)) {
    if (p.type === "text") frag.append(p.text);
    else if (p.type === "fact") frag.append(factButton(p.id, ctx, ctx.lang));
    else {
      const para = ctx.data?.paragraphs.get(p.id);
      frag.append(para?.html_url
        ? h("a", { class: "cite-ref", href: para.html_url, target: "_blank", rel: "noopener noreferrer" }, citeText(ctx.data, p.id))
        : h("span", { class: "cite-ref" }, citeText(ctx.data, p.id)));
    }
  }
  return frag;
}

/** A figure that opens its source; value in the given language. */
export function factButton(id, ctx, lng) {
  const btn = h("button", { type: "button", class: "fact-ref", dataset: { fact: id } }, factText(ctx.state?.facts, id, lng));
  btn.addEventListener("click", () => openFactDetails(id, ctx));
  return btn;
}
