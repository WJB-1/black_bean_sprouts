// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { BlockNode } from "./index.js";

export interface Cover extends BlockBase {
  type: "cover";
  attrs: {
    layout: "from-template" | "centered" | "custom";
  };
  content: BlockNode[];
}
