// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { BlockNode } from "./index.js";

export interface Section extends BlockBase {
  type: "section";
  attrs: {
    level: 1 | 2 | 3 | 4 | 5;
    title: string;
    label?: string;
  };
  content: BlockNode[];
}
