// @doc-schema-version: 1.0.0
import type { Text } from "./text.js";
import type { CitationRef } from "./citation-ref.js";
import type { XRef } from "./xref.js";
import type { InlineFormula } from "./inline-formula.js";
import type { FootnoteRef } from "./footnote-ref.js";

export type InlineNode =
  | Text
  | CitationRef
  | XRef
  | InlineFormula
  | FootnoteRef;
