export type PageLayout = {
  readonly width: number;
  readonly height: number;
  readonly marginTop: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly marginRight: number;
};

export type FontConfig = {
  readonly defaultFamily: string;
  readonly headingFamily: string;
  readonly defaultSize: number;
  readonly lineSpacing: number;
};

export type HeadingStyle = {
  readonly size: number;
  readonly bold: boolean;
  readonly color?: string;
  readonly spacingBefore: number;
  readonly spacingAfter: number;
};

export type HeadingStyleMap = {
  readonly h1: HeadingStyle;
  readonly h2: HeadingStyle;
  readonly h3: HeadingStyle;
  readonly h4?: HeadingStyle;
  readonly h5?: HeadingStyle;
  readonly h6?: HeadingStyle;
};

export type CaptionStyle = {
  readonly size: number;
  readonly italic: boolean;
  readonly alignment: "center" | "left" | "right";
};

export type NumberingConfig = {
  readonly figureFormat: string;
  readonly tableFormat: string;
  readonly equationFormat: string;
};

export type ReferenceFormatConfig = {
  readonly style: "apa" | "mla" | "chicago" | "vancouver";
  readonly bracketStyle: "parentheses" | "brackets" | "superscript";
};

export type StyleProfileDsl = {
  readonly id: string;
  readonly hash: string;
  readonly name: string;
  readonly pageLayout: PageLayout;
  readonly fonts: FontConfig;
  readonly headings: HeadingStyleMap;
  readonly figureCaption: CaptionStyle;
  readonly tableCaption: CaptionStyle;
  readonly referenceFormat: ReferenceFormatConfig;
  readonly numbering: NumberingConfig;
};

export type BuiltInStyleProfile = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly profile: StyleProfileDsl;
};

export type StyleProfileAdjustments = {
  readonly bodyFontSize?: number;
  readonly lineSpacing?: number;
  readonly marginTop?: number;
  readonly marginBottom?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
};

export function computeProfileHash(profile: Omit<StyleProfileDsl, "hash">): string {
  const data = JSON.stringify(profile);
  let hash = 0;
  for (let index = 0; index < data.length; index += 1) {
    hash = ((hash << 5) - hash) + data.charCodeAt(index);
    hash |= 0;
  }
  return "sp_" + Math.abs(hash).toString(36);
}

export function createStyleProfile(profile: Omit<StyleProfileDsl, "hash">): StyleProfileDsl {
  return {
    ...profile,
    hash: computeProfileHash(profile),
  };
}

function withoutHash(profile: StyleProfileDsl): Omit<StyleProfileDsl, "hash"> {
  const { hash: _hash, ...rest } = profile;
  return rest;
}

const academicClassic = createStyleProfile({
  id: "default",
  name: "\u5B66\u672F\u7ECF\u5178",
  pageLayout: {
    width: 210,
    height: 297,
    marginTop: 25,
    marginBottom: 25,
    marginLeft: 30,
    marginRight: 25,
  },
  fonts: {
    defaultFamily: "Times New Roman",
    headingFamily: "Arial",
    defaultSize: 24,
    lineSpacing: 1.5,
  },
  headings: {
    h1: { size: 32, bold: true, spacingBefore: 360, spacingAfter: 200 },
    h2: { size: 28, bold: true, spacingBefore: 280, spacingAfter: 160 },
    h3: { size: 24, bold: true, spacingBefore: 240, spacingAfter: 120 },
  },
  figureCaption: { size: 20, italic: true, alignment: "center" },
  tableCaption: { size: 20, italic: true, alignment: "center" },
  referenceFormat: { style: "apa", bracketStyle: "parentheses" },
  numbering: {
    figureFormat: "Figure {section}.{n}",
    tableFormat: "Table {section}.{n}",
    equationFormat: "Eq. {section}.{n}",
  },
});

const compactReport = createStyleProfile({
  ...withoutHash(academicClassic),
  id: "compact-report",
  name: "\u7D27\u51D1\u62A5\u544A",
  fonts: {
    defaultFamily: "Calibri",
    headingFamily: "Calibri",
    defaultSize: 22,
    lineSpacing: 1.25,
  },
  pageLayout: {
    width: 210,
    height: 297,
    marginTop: 18,
    marginBottom: 18,
    marginLeft: 20,
    marginRight: 20,
  },
  headings: {
    h1: { size: 30, bold: true, spacingBefore: 280, spacingAfter: 160 },
    h2: { size: 26, bold: true, spacingBefore: 220, spacingAfter: 140 },
    h3: { size: 22, bold: true, spacingBefore: 180, spacingAfter: 100 },
  },
});

const chineseThesis = createStyleProfile({
  ...withoutHash(academicClassic),
  id: "chinese-thesis",
  name: "\u4E2D\u6587\u8BBA\u6587",
  fonts: {
    defaultFamily: "SimSun",
    headingFamily: "Microsoft YaHei",
    defaultSize: 24,
    lineSpacing: 1.75,
  },
  pageLayout: {
    width: 210,
    height: 297,
    marginTop: 30,
    marginBottom: 25,
    marginLeft: 30,
    marginRight: 25,
  },
  headings: {
    h1: { size: 32, bold: true, spacingBefore: 400, spacingAfter: 220 },
    h2: { size: 28, bold: true, spacingBefore: 320, spacingAfter: 180 },
    h3: { size: 24, bold: true, spacingBefore: 260, spacingAfter: 140 },
  },
});

const airyReview = createStyleProfile({
  ...withoutHash(academicClassic),
  id: "airy-review",
  name: "\u5BBD\u677E\u5BA1\u9605",
  fonts: {
    defaultFamily: "Georgia",
    headingFamily: "Arial",
    defaultSize: 26,
    lineSpacing: 1.9,
  },
  pageLayout: {
    width: 210,
    height: 297,
    marginTop: 28,
    marginBottom: 28,
    marginLeft: 28,
    marginRight: 28,
  },
  headings: {
    h1: { size: 34, bold: true, spacingBefore: 420, spacingAfter: 240 },
    h2: { size: 30, bold: true, spacingBefore: 340, spacingAfter: 200 },
    h3: { size: 26, bold: true, spacingBefore: 280, spacingAfter: 160 },
  },
});

export const builtInStyleProfiles: readonly BuiltInStyleProfile[] = Object.freeze([
  {
    id: academicClassic.id,
    name: "\u5B66\u672F\u7ECF\u5178",
    description: "\u9002\u5408\u5E38\u89C1\u8BBA\u6587\u4E0E\u62A5\u544A\u7684\u901A\u7528\u6392\u7248\u3002",
    profile: academicClassic,
  },
  {
    id: compactReport.id,
    name: "\u7D27\u51D1\u62A5\u544A",
    description: "\u9875\u8FB9\u8DDD\u66F4\u7D27\u51D1\uFF0C\u9002\u5408\u5185\u90E8\u62A5\u544A\u548C\u7B80\u62A5\u3002",
    profile: compactReport,
  },
  {
    id: chineseThesis.id,
    name: "\u4E2D\u6587\u8BBA\u6587",
    description: "\u66F4\u9002\u5408\u4E2D\u6587\u6B63\u6587\u3001\u8F83\u5BBD\u884C\u8DDD\u548C\u5B66\u4F4D\u8BBA\u6587\u573A\u666F\u3002",
    profile: chineseThesis,
  },
  {
    id: airyReview.id,
    name: "\u5BBD\u677E\u5BA1\u9605",
    description: "\u5B57\u53F7\u548C\u884C\u8DDD\u66F4\u5927\uFF0C\u4FBF\u4E8E\u6253\u5370\u5BA1\u9605\u4E0E\u6279\u6CE8\u3002",
    profile: airyReview,
  },
]);

export const defaultStyleProfile: StyleProfileDsl = academicClassic;

export function listBuiltInStyleProfiles(): readonly BuiltInStyleProfile[] {
  return builtInStyleProfiles;
}

export function getBuiltInStyleProfile(id: string | undefined): BuiltInStyleProfile | undefined {
  if (!id) {
    return builtInStyleProfiles[0];
  }
  return builtInStyleProfiles.find((item) => item.id === id);
}

export function applyStyleProfileAdjustments(
  baseProfile: StyleProfileDsl,
  adjustments: StyleProfileAdjustments = {},
): StyleProfileDsl {
  return createStyleProfile({
    ...withoutHash(baseProfile),
    pageLayout: {
      ...baseProfile.pageLayout,
      ...(adjustments.marginTop !== undefined ? { marginTop: adjustments.marginTop } : {}),
      ...(adjustments.marginBottom !== undefined ? { marginBottom: adjustments.marginBottom } : {}),
      ...(adjustments.marginLeft !== undefined ? { marginLeft: adjustments.marginLeft } : {}),
      ...(adjustments.marginRight !== undefined ? { marginRight: adjustments.marginRight } : {}),
    },
    fonts: {
      ...baseProfile.fonts,
      ...(adjustments.bodyFontSize !== undefined ? { defaultSize: adjustments.bodyFontSize } : {}),
      ...(adjustments.lineSpacing !== undefined ? { lineSpacing: adjustments.lineSpacing } : {}),
    },
  });
}
