// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";

export interface ToCPlaceholder extends BlockBase {
  type: "toc_placeholder";
  attrs?: {
    maxLevel?: number;
  };
}
