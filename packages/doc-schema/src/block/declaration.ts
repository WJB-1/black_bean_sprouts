// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { InlineNode } from "../inline/index.js";

export interface Declaration extends BlockBase {
  type: "declaration";
  content: InlineNode[];
}
