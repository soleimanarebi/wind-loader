/** Reference documents (calc-spec §10). */
export const DOCUMENTS = {
  EN: { title: "BS EN 1991-1-4:2005+A1:2010 Eurocode 1: Actions on structures — Part 1-4: General actions — Wind actions" },
  NA: { title: "NA to BS EN 1991-1-4:2005+A1:2010 UK National Annex to Eurocode 1: Actions on structures — Part 1-4: Wind actions" },
  PD: { title: "PD 6688-1-4:2015 Background information to the National Annex to BS EN 1991-1-4 and additional guidance" },
  CWCT: { title: "CWCT Standard for systemised building envelopes, Part 2: Loads, fixings and movement" },
  BX: { title: "Example report: Brent Cross Town Plot 202, Loads and load combinations, Glass & Façade Solutions, 24 June 2022" },
  ISCA: { title: "Example report and spreadsheet: ISCA Place, Exeter, Wind load calculation report, Glass & Façade Solutions, May 2026" },
} as const;

export type DocId = keyof typeof DOCUMENTS;

export interface Source {
  doc: DocId;
  /** Clause, table, equation or figure. */
  ref: string;
  /** Printed page number. */
  page: string;
}

export interface Sourced<T> {
  value: T;
  source: Source;
}

export const src = (doc: DocId, ref: string, page: string | number): Source => ({ doc, ref, page: String(page) });

/** Marks a value the documents do not give (see docs/open-questions.md). */
export const TODO_VALUE = Symbol("TODO_VALUE");
