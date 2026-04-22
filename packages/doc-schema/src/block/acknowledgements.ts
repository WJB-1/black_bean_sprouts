// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { InlineNode } from "../inline/index.js";

export interface Acknowledgements extends BlockBase {
  type: "acknowledgements";
  content: InlineNode[];
}
