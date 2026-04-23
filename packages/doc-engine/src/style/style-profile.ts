export type PageLayout = {
  readonly width: number; readonly height: number;
  readonly marginTop: number; readonly marginBottom: number;
  readonly marginLeft: number; readonly marginRight: number;
};

export type FontConfig = {
  readonly defaultFamily: string; readonly headingFamily: string;
  readonly defaultSize: number; readonly lineSpacing: number;
};

export type HeadingStyle = {
  readonly size: number; readonly bold: boolean; readonly color?: string;
  readonly spacingBefore: number; readonly spacingAfter: number;
};

export type HeadingStyleMap = {
  readonly h1: HeadingStyle; readonly h2: HeadingStyle; readonly h3: HeadingStyle;
  readonly h4?: HeadingStyle; readonly h5?: HeadingStyle; readonly h6?: HeadingStyle;
};

export type CaptionStyle = { readonly size: number; readonly italic: boolean; readonly alignment: "center" | "left" | "right"; };
export type NumberingConfig = { readonly figureFormat: string; readonly tableFormat: string; readonly equationFormat: string; };
export type ReferenceFormatConfig = { readonly style: "apa" | "mla" | "chicago" | "vancouver"; readonly bracketStyle: "parentheses" | "brackets" | "superscript"; };

export type StyleProfileDsl = {
  readonly id: string; readonly hash: string; readonly name: string;
  readonly pageLayout: PageLayout; readonly fonts: FontConfig;
  readonly headings: HeadingStyleMap;
  readonly figureCaption: CaptionStyle; readonly tableCaption: CaptionStyle;
  readonly referenceFormat: ReferenceFormatConfig; readonly numbering: NumberingConfig;
};

export function computeProfileHash(profile: Omit<StyleProfileDsl, "hash">): string {
  const data = JSON.stringify(profile);
  let h = 0;
  for (let i = 0; i < data.length; i++) { h = ((h << 5) - h) + data.charCodeAt(i); h |= 0; }
  return "sp_" + Math.abs(h).toString(36);
}

export const defaultStyleProfile: StyleProfileDsl = {
  id: "default", name: "Default Academic", hash: "sp_default",
  pageLayout: { width: 210, height: 297, marginTop: 25, marginBottom: 25, marginLeft: 30, marginRight: 25 },
  fonts: { defaultFamily: "Times New Roman", headingFamily: "Arial", defaultSize: 24, lineSpacing: 1.5 },
  headings: {
    h1: { size: 32, bold: true, spacingBefore: 360, spacingAfter: 200 },
    h2: { size: 28, bold: true, spacingBefore: 280, spacingAfter: 160 },
    h3: { size: 24, bold: true, spacingBefore: 240, spacingAfter: 120 },
  },
  figureCaption: { size: 20, italic: true, alignment: "center" },
  tableCaption: { size: 20, italic: true, alignment: "center" },
  referenceFormat: { style: "apa", bracketStyle: "parentheses" },
  numbering: { figureFormat: "Figure {section}.{n}", tableFormat: "Table {section}.{n}", equationFormat: "Eq. {section}.{n}" },
};
