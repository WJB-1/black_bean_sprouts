import type { StyleProfileDsl, HeadingStyle } from "./style-profile.js";

// ---- Resolved types ----

export type PageLayoutTwips = {
  readonly width: number;
  readonly height: number;
  readonly margins: {
    readonly top: number;
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
  };
};

export type ResolvedHeadingStyle = {
  readonly size: number;
  readonly bold: boolean;
  readonly color?: string;
  readonly spacingBefore: number;
  readonly spacingAfter: number;
};

export type ResolvedStyleProfile = {
  readonly profile: StyleProfileDsl;
  readonly resolvedAt: number;
  readonly pageLayoutTwips: PageLayoutTwips;
  readonly headingStyles: ReadonlyMap<number, ResolvedHeadingStyle>;
  readonly bodyFontFamily: string;
  readonly bodyFontSize: number;
};

// ---- Pure helpers ----

function mmToTwip(mm: number): number {
  return Math.round(mm * 56.7);
}

function resolveHeadingStyles(
  headings: StyleProfileDsl["headings"]
): ReadonlyMap<number, ResolvedHeadingStyle> {
  const map = new Map<number, ResolvedHeadingStyle>();

  const entries: ReadonlyArray<readonly [number, HeadingStyle]> = [
    [1, headings.h1],
    [2, headings.h2],
    [3, headings.h3],
  ];

  // Levels 1-3 are always present
  for (const [level, style] of entries) {
    map.set(level, {
      size: style.size,
      bold: style.bold,
      ...(style.color !== undefined ? { color: style.color } : {}),
      spacingBefore: style.spacingBefore,
      spacingAfter: style.spacingAfter,
    });
  }

  // Levels 4-6 are optional; fall back to h3 if absent
  const optional: ReadonlyArray<readonly [number, HeadingStyle | undefined]> = [
    [4, headings.h4],
    [5, headings.h5],
    [6, headings.h6],
  ];

  for (const [level, style] of optional) {
    if (style !== undefined) {
      map.set(level, {
        size: style.size,
        bold: style.bold,
        ...(style.color !== undefined ? { color: style.color } : {}),
        spacingBefore: style.spacingBefore,
        spacingAfter: style.spacingAfter,
      });
    }
  }

  return map;
}

function resolvePageLayout(
  pageLayout: StyleProfileDsl["pageLayout"]
): PageLayoutTwips {
  return {
    width: mmToTwip(pageLayout.width),
    height: mmToTwip(pageLayout.height),
    margins: {
      top: mmToTwip(pageLayout.marginTop),
      bottom: mmToTwip(pageLayout.marginBottom),
      left: mmToTwip(pageLayout.marginLeft),
      right: mmToTwip(pageLayout.marginRight),
    },
  };
}

function resolveProfile(profile: StyleProfileDsl): ResolvedStyleProfile {
  return Object.freeze({
    profile,
    resolvedAt: Date.now(),
    pageLayoutTwips: resolvePageLayout(profile.pageLayout),
    headingStyles: resolveHeadingStyles(profile.headings),
    bodyFontFamily: profile.fonts.defaultFamily,
    bodyFontSize: profile.fonts.defaultSize,
  });
}

// ---- Cache ----

export class StyleResolverCache {
  private readonly cache = new Map<string, ResolvedStyleProfile>();

  resolve(profile: StyleProfileDsl): ResolvedStyleProfile {
    const cached = this.cache.get(profile.hash);
    if (cached !== undefined) {
      return cached;
    }

    const resolved = resolveProfile(profile);
    this.cache.set(profile.hash, resolved);
    return resolved;
  }

  invalidate(hash: string): void {
    this.cache.delete(hash);
  }

  clear(): void {
    this.cache.clear();
  }
}
