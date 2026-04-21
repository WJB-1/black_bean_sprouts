// @doc-schema-version: 1.0.0

/** 行内公式: 如 $E=mc^2$ */
export interface InlineFormula {
  type: "inline_formula";
  attrs: { latex: string };
}
