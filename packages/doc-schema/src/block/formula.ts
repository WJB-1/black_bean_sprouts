// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";

export interface Formula extends BlockBase {
  type: "formula";
  attrs: {
    latex: string;
    display: true;
    label?: string;
  };
}
