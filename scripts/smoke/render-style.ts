import {
  applyStyleProfileAdjustments,
  listBuiltInStyleProfiles,
  StyleResolverCache,
  defaultStyleProfile,
} from "@black-bean-sprouts/doc-engine";

async function main() {
  console.log("smoke:render-style - Testing StyleResolverCache...");
  const cache = new StyleResolverCache();
  const builtIns = listBuiltInStyleProfiles();

  if (!Array.isArray(builtIns) || builtIns.length < 2) {
    console.error("FAIL: built-in style profiles not available");
    process.exit(1);
  }

  const resolved1 = cache.resolve(defaultStyleProfile);
  if (!resolved1.pageLayoutTwips || resolved1.pageLayoutTwips.width <= 0) {
    console.error("FAIL: page layout not resolved");
    process.exit(1);
  }
  if (!resolved1.headingStyles || resolved1.headingStyles.size < 3) {
    console.error("FAIL: heading styles not resolved");
    process.exit(1);
  }
  if (resolved1.bodyFontSize <= 0) {
    console.error("FAIL: body font size not resolved");
    process.exit(1);
  }

  // Test caching — second resolve returns same object
  const resolved2 = cache.resolve(defaultStyleProfile);
  if (resolved1 !== resolved2) {
    console.error("FAIL: cache did not return same object");
    process.exit(1);
  }

  // Test invalidation
  cache.invalidate(defaultStyleProfile.hash);
  const resolved3 = cache.resolve(defaultStyleProfile);
  if (resolved1 === resolved3) {
    console.error("FAIL: invalidate did not work");
    process.exit(1);
  }

  const adjusted = applyStyleProfileAdjustments(defaultStyleProfile, {
    bodyFontSize: 28,
    lineSpacing: 1.9,
    marginLeft: 22,
    marginRight: 18,
  });
  if (adjusted.fonts.defaultSize !== 28 || adjusted.fonts.lineSpacing !== 1.9) {
    console.error("FAIL: style adjustments not applied");
    process.exit(1);
  }
  if (adjusted.pageLayout.marginLeft !== 22 || adjusted.pageLayout.marginRight !== 18) {
    console.error("FAIL: margin adjustments not applied");
    process.exit(1);
  }

  console.log("PASS: StyleResolverCache works, page width=" +
    resolved3.pageLayoutTwips.width + " twips, headings=" +
    resolved3.headingStyles.size + ", body=" +
    resolved3.bodyFontSize + "pt, profiles=" +
    builtIns.length);
}
main().catch(e => { console.error(e); process.exit(1); });
