// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { InlineNode } from "../inline";

export interface Acknowledgements extends BlockBase {
  type: "acknowledgements";
  content: InlineNode[];
}
