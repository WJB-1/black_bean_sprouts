import type { Doc, BlockNode } from "./doc/types.js";

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

export function isValidDoc(doc: Doc): ValidationResult {
  const errors: string[] = [];
  if (typeof doc.version !== "number" || doc.version < 0) errors.push("doc.version must be a non-negative number");
  if (!doc.metadata || typeof doc.metadata.title !== "string" || doc.metadata.title.length === 0) errors.push("doc.metadata.title is required");
  if (!Array.isArray(doc.children)) { errors.push("doc.children must be an array"); }
  else { const ids = new Set<string>(); validateBlockList(doc.children, ids, errors, "root"); }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateBlockList(blocks: readonly BlockNode[], ids: Set<string>, errors: string[], ctx: string): void {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const p = ctx + "[" + i + "]";
    if (!b.id || typeof b.id !== "string") errors.push(p + ": missing or invalid id");
    else if (ids.has(b.id)) errors.push(p + ": duplicate id " + b.id);
    else ids.add(b.id);
    if (!b.type) errors.push(p + ": missing type");
    if (b.type === "section") validateBlockList((b as import("./doc/types.js").SectionBlock).children, ids, errors, p);
  }
}
