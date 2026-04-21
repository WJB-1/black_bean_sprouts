// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { BlockNode } from "./index";

export interface Appendix extends BlockBase {
  type: "appendix";
  attrs: {
    label: string;
    title: string;
  };
  content: BlockNode[];
}
