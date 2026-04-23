export { DocxRenderer } from "./renderer/docx-renderer.js";
export type { RenderResult } from "./renderer/docx-renderer.js";

export { StyleResolverCache } from "./style/style-resolver.js";
export type { ResolvedStyleProfile, ResolvedHeadingStyle, PageLayoutTwips } from "./style/style-resolver.js";

export type { StyleProfileDsl, PageLayout, FontConfig, HeadingStyleMap, CaptionStyle, NumberingConfig, ReferenceFormatConfig } from "./style/style-profile.js";
export { defaultStyleProfile, computeProfileHash } from "./style/style-profile.js";

export { RenderPlanner } from "./render-planner.js";
export type { RenderPlan, RenderPlanInput } from "./render-planner.js";
