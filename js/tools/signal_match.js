// Signal agent: links the synthetic complaints to duty cards by the data they mention.
import { unknownId } from "./errors.js";

const norm = (s) => String(s).toLocaleLowerCase("de-DE");

export default {
  name: "signal_match",
  run({ duty_ids }, { data, state }) {
    const matches = duty_ids.map((id) => {
      const duty = state.duties.get(id);
      if (!duty) throw unknownId(id);
      const names = duty.data_items.filter((i) => !String(i).startsWith("other:")).flatMap((i) => {
        const v = data.vocabById.get(i);
        return v ? [v.label, ...(v.synonyms || [])] : [];
      }).map(norm).filter((n) => n.length >= 4);
      const complaint_ids = data.complaints.filter((k) => names.some((n) => norm(k.text).includes(n))).map((k) => k.id);
      state.setSignals(id, complaint_ids);
      return { duty_id: id, complaint_ids };
    });
    return { result: { matches }, summary: { code: "tool.signal_match", params: { duties: matches.length, complaints: new Set(matches.flatMap((m) => m.complaint_ids)).size } } };
  }
};
