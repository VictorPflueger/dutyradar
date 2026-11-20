// Once-only matcher: the register (simulated) that best covers a duty's or a cluster's data.
import { unknownId } from "./errors.js";

export default {
  name: "once_registers",
  run({ target }, { data, state }) {
    const reg = state.registerFor(target);
    if (!reg) throw unknownId(target);
    const r = reg.register_id ? data.registersById.get(reg.register_id) : null;
    const register = r ? { register_id: r.id, label: r.label, covers_items: reg.covers_items, covers_duty_ids: reg.covers_duty_ids, availability: r.availability } : null;
    return { result: { target, register, uncovered_items: reg.uncovered_items || [] }, summary: { code: register ? "tool.once_registers" : "tool.once_registers_none", params: { target, register: register?.register_id || null } } };
  }
};
