// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { BlockNode } from "./index";

export interface Cover extends BlockBase {
  type: "cover";
  attrs: {
    layout: "from-template" | "centered" | "custom";
  };
  content: BlockNode[];
}
