// @doc-schema-version: 1.0.0
import { applyDocumentPatches, isValidDoc, type DocumentPatch } from "@black-bean-sprouts/doc-schema";
import { badRequest } from "../lib/errors.js";
import { getDocument, updateDocumentContent } from "./document.js";

export async function applyPatchesToDocument(params: {
  documentId: string;
  userId: string;
  patches: readonly DocumentPatch[];
}) {
  const document = await getDocument(params.documentId, params.userId);
  if (!isValidDoc(document.content)) {
    throw badRequest("当前文档内容不是合法 Doc AST");
  }

  const nextDoc = applyDocumentPatches(document.content, params.patches);
  if (!isValidDoc(nextDoc)) {
    throw badRequest("Patch 应用后文档不再符合 Doc Schema");
  }

  return updateDocumentContent(document.id, params.userId, nextDoc);
}
