import { StyleResolverCache, defaultStyleProfile } from "@black-bean-sprouts/doc-engine";

async function main() {
  console.log("smoke:render-style - Testing StyleResolverCache...");
  const cache = new StyleResolverCache();

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

  console.log("PASS: StyleResolverCache works, page width=" +
    resolved3.pageLayoutTwips.width + " twips, headings=" +
    resolved3.headingStyles.size + ", body=" +
    resolved3.bodyFontSize + "pt");
}
main().catch(e => { console.error(e); process.exit(1); });
