// @doc-schema-version: 1.0.0

export interface FontFamily {
  eastAsian: string;
  latin: string;
  fallback?: string[];
}

export interface FontFamilies {
  body: FontFamily;
  heading: FontFamily;
  caption: FontFamily;
  monospace: FontFamily;
  baseSize: number;
}
