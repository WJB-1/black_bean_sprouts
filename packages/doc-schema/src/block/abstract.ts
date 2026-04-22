// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base.js";
import type { Paragraph } from "./paragraph.js";

export interface Abstract extends BlockBase {
  type: "abstract";
  attrs: {
    language: "zh" | "en";
    keywords: string[];
  };
  content: Paragraph[];
}
