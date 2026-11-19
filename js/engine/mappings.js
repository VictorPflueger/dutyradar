// Classification mappings: the model classifies in categories, code turns them into numbers (pure).

/** frequency_term → frequency_per_year; "täglich" is 250 working days, labelled as an assumption. */
export const FREQUENCY_PER_YEAR = Object.freeze({ täglich: 250, wöchentlich: 52, monatlich: 12, vierteljährlich: 4, halbjährlich: 2, jährlich: 1 });
/** certainty → confidence; "niedrig" sends the duty to review. */
export const CONFIDENCE = Object.freeze({ hoch: 0.9, mittel: 0.7, niedrig: 0.5 });
/** A duty below this confidence needs review. */
export const REVIEW_BELOW = 0.6;

/**
 * Numbers and status for one classification: frequency only for periodic duties, confidence from
 * the certainty, status rejected when the model finds no duty, needs_review below 0.6, otherwise
 * confirmed.
 */
export function mapClassification(c) {
  const periodic = c.trigger === "periodisch";
  const frequency = periodic && c.frequency_term ? FREQUENCY_PER_YEAR[c.frequency_term] ?? null : null;
  const confidence = CONFIDENCE[c.certainty] ?? CONFIDENCE.niedrig;
  const status = c.is_duty === false ? "rejected" : confidence < REVIEW_BELOW ? "needs_review" : "confirmed";
  return {
    frequency_per_year: frequency,
    frequency_assumption: periodic && c.frequency_term === "täglich" ? "working_days" : null,
    confidence,
    status
  };
}
