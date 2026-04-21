// @doc-schema-version: 1.0.0

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strikethrough" }
  | { type: "superscript" }
  | { type: "subscript" }
  | { type: "link"; attrs: { href: string } };

export interface Text {
  type: "text";
  text: string;
  marks?: Mark[];
}
