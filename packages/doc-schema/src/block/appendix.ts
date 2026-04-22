// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { BlockNode } from "./index.js";

export interface Appendix extends BlockBase {
  type: "appendix";
  attrs: {
    label: string;
    title: string;
  };
  content: BlockNode[];
}
