// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { InlineNode } from "../inline";

export interface Declaration extends BlockBase {
  type: "declaration";
  content: InlineNode[];
}
