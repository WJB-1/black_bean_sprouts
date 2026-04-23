// ============================================================================
// DocumentPatchBatch — 版本化原子批次 (B1)
// 每个批次携带 expectedVersion，防止并发静默覆盖
// ============================================================================

import type { DocumentPatch } from "./types.js";

export type PatchSource = "user" | "agent" | "system";

export type DocumentPatchBatch = {
  readonly expectedVersion: number;
  readonly patches: readonly DocumentPatch[];
  readonly source: PatchSource;
};

export type PatchConflictError = {
  readonly type: "PatchConflictError";
  readonly expectedVersion: number;
  readonly currentVersion: number;
  readonly message: string;
};

export function createPatchConflictError(
  expectedVersion: number,
  currentVersion: number
): PatchConflictError {
  return {
    type: "PatchConflictError",
    expectedVersion,
    currentVersion,
    message: `Version conflict: expected ${expectedVersion}, but current is ${currentVersion}`,
  };
}

export function isPatchConflictError(error: unknown): error is PatchConflictError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as PatchConflictError).type === "PatchConflictError"
  );
}

export function createBatch(
  expectedVersion: number,
  patches: readonly DocumentPatch[],
  source: PatchSource = "user"
): DocumentPatchBatch {
  return { expectedVersion, patches, source };
}
