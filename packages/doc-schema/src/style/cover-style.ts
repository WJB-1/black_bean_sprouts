// @doc-schema-version: 1.0.0

export interface CoverStyle {
  layout: "from-template" | "centered" | "custom";
  fields?: CoverFieldStyle[];
}

export interface CoverFieldStyle {
  name: string;
  font?: string;
  size?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  position?: string;
}
