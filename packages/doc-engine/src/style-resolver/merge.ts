/**
 * Deep merge two objects. `child` values take priority over `parent`.
 * Handles nested objects recursively. Arrays are replaced, not concatenated.
 */
export function deepMerge<T extends object>(
  parent: T,
  child: Partial<T>,
): T {
  const result = { ...parent } as Record<string, unknown>;

  for (const key of Object.keys(child as Partial<Record<string, unknown>>)) {
    const childVal = (child as Partial<Record<string, unknown>>)[key];
    const parentVal = result[key];

    if (
      isPlainObject(childVal) &&
      isPlainObject(parentVal)
    ) {
      result[key] = deepMerge(
        parentVal as object,
        childVal as Partial<object>,
      );
    } else if (childVal !== undefined) {
      result[key] = childVal;
    }
  }

  return result as T;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
