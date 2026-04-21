// @doc-schema-version: 1.0.0
import type { BlockBase } from "../base";

export interface ReferenceListPlaceholder extends BlockBase {
  type: "reference_list_placeholder";
  attrs?: {
    sortOrder?: "appearance" | "alphabetical";
  };
}
