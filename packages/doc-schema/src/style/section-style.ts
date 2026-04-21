// @doc-schema-version: 1.0.0

export interface SectionStyle {
  font?: string;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  spaceBefore?: string;
  spaceAfter?: string;
  color?: string;
}

export type SectionStyles = Record<string, SectionStyle>;
