// @doc-schema-version: 1.0.0
import Ajv from "ajv";
import type { Doc } from "../doc.js";
import type { DocumentPatch } from "../patch/types.js";
import type { StyleProfile } from "../style/profile.js";
import { DocSchema } from "./doc-schema.js";
import { DocumentPatchArraySchema, DocumentPatchSchema } from "./patch-schemas.js";
import { StyleProfileSchema } from "./style-schemas.js";

const ajv = new Ajv({ strict: false });

// Pre-compile validators
export const validateDoc = ajv.compile(DocSchema);
export const validateDocumentPatch = ajv.compile(DocumentPatchSchema);
export const validateDocumentPatchArray = ajv.compile(DocumentPatchArraySchema);
export const validateStyleProfile = ajv.compile(StyleProfileSchema);

/**
 * Validate a full Doc AST against the schema.
 * Agent 输出的任意 JSON 必须经过校验后才能应用到文档。
 */
export function isValidDoc(data: unknown): data is Doc {
  return Boolean(validateDoc(data));
}

/**
 * Validate a single DocumentPatch payload.
 */
export function isValidDocumentPatch(data: unknown): data is DocumentPatch {
  return Boolean(validateDocumentPatch(data));
}

/**
 * Validate a DocumentPatch[] payload.
 */
export function isValidDocumentPatchArray(data: unknown): data is DocumentPatch[] {
  return Boolean(validateDocumentPatchArray(data));
}

/**
 * Validate a StyleProfile.
 */
export function isValidStyleProfile(data: unknown): data is StyleProfile {
  return Boolean(validateStyleProfile(data));
}
