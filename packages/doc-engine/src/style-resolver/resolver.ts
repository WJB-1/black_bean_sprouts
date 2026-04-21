// @doc-schema-version: 1.0.0
import type { StyleProfile } from "@black-bean-sprouts/doc-schema";
import { deepMerge } from "./merge.js";
import { defaultStyleProfile } from "./defaults.js";

/**
 * Resolve a StyleProfile by walking the `extends` chain.
 * Parent profiles are merged first, child overrides parent.
 * Falls back to defaults for missing fields.
 */
export function resolveStyleProfile(
  profile: StyleProfile,
  lookup: (id: string) => StyleProfile | undefined,
): StyleProfile {
  if (!profile.extends) {
    return deepMerge(defaultStyleProfile, profile);
  }

  const parent = lookup(profile.extends);
  if (!parent) {
    return deepMerge(defaultStyleProfile, profile);
  }

  const resolvedParent = resolveStyleProfile(parent, lookup);
  const { extends: _extends, ...childFields } = profile;
  void _extends;
  return deepMerge(resolvedParent, childFields as Partial<StyleProfile>);
}
