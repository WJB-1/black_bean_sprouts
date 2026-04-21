// @doc-schema-version: 1.0.0

export type NumberingStyle =
  | "arabic" | "chinese" | "chinese-upper"
  | "roman-lower" | "roman-upper"
  | "letter-lower" | "letter-upper";

export interface NumberingLevel {
  style: NumberingStyle;
  startAt?: number;
}

export interface NumberingScheme {
  levels: NumberingLevel[];
  resetOn: "section1" | "section2" | "none";
  format: string;
  prefix?: string;
  suffix?: string;
}

export interface NumberingSchemes {
  section: NumberingScheme[];
  figure: NumberingScheme;
  table: NumberingScheme;
  formula: NumberingScheme;
  appendix: NumberingScheme;
  reference: NumberingScheme;
}
