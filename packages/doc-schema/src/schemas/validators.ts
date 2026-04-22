// @doc-schema-version: 1.0.0
import Ajv from "ajv";
import { DocSchema } from "./doc-schema.js";
import { StyleProfileSchema } from "./style-schemas.js";

const ajv = new Ajv({ strict: false });

// Pre-compile validators
export const validateDoc = ajv.compile(DocSchema);
export const validateStyleProfile = ajv.compile(StyleProfileSchema);

/**
 * Validate a full Doc AST against the schema.
 * Agent 输出的任何 JSON 必须经过校验后才能应用到文档。
 */
export function isValidDoc(data: unknown): data is Record<string, unknown> {
  return validateDoc(data) as boolean;
}

/**
 * Validate a StyleProfile.
 */
export function isValidStyleProfile(data: unknown): data is Record<string, unknown> {
  return validateStyleProfile(data) as boolean;
}
