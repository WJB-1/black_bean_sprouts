// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";
import type { Paragraph } from "./paragraph";

export interface Abstract extends BlockBase {
  type: "abstract";
  attrs: {
    language: "zh" | "en";
    keywords: string[];
  };
  content: Paragraph[];
}
