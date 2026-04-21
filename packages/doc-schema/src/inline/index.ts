// @doc-schema-version: 1.0.0
import type { Text } from "./text";
import type { CitationRef } from "./citation-ref";
import type { XRef } from "./xref";
import type { InlineFormula } from "./inline-formula";
import type { FootnoteRef } from "./footnote-ref";

export type InlineNode =
  | Text
  | CitationRef
  | XRef
  | InlineFormula
  | FootnoteRef;
