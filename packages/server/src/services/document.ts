// @doc-schema-version: 1.0.0
import { isValidDoc, type Doc } from "@black-bean-sprouts/doc-schema";
import type { Prisma } from "@prisma/client";
import { badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export async function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      docTypeId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getDocument(id: string, userId: string) {
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== userId) {
    throw notFound("文档不存在");
  }
  return document;
}

export async function createDocument(data: {
  userId: string;
  docTypeId: string;
  title?: string;
  styleProfileId?: string;
}) {
  const resolvedDocTypeId = await resolveDocTypeId(data.docTypeId);
  const emptyDoc: Doc = {
    type: "doc",
    schemaVersion: "1.0.0",
    attrs: {
      title: data.title ?? "未命名文档",
      authors: [],
      docLanguage: "zh",
    },
    content: [],
    references: {},
    assets: {},
    footnotes: {},
  };

  return prisma.document.create({
    data: {
      userId: data.userId,
      docTypeId: resolvedDocTypeId,
      ...(data.styleProfileId !== undefined && { styleProfileId: data.styleProfileId }),
      title: data.title ?? "未命名文档",
      content: emptyDoc as unknown as Prisma.InputJsonValue,
      meta: {},
    },
  });
}

export async function updateDocumentContent(
  id: string,
  userId: string,
  content: unknown,
) {
  const document = await getDocument(id, userId);
  if (!isValidDoc(content)) {
    throw badRequest("文档内容不是合法 Doc AST");
  }

  return prisma.document.update({
    where: { id: document.id },
    data: { content: content as unknown as Prisma.InputJsonValue },
  });
}

export async function deleteDocument(id: string, userId: string) {
  const document = await getDocument(id, userId);
  await prisma.document.delete({ where: { id: document.id } });
}

async function resolveDocTypeId(input: string): Promise<string> {
  const docType = await prisma.docType.findFirst({
    where: {
      isActive: true,
      OR: [{ id: input }, { code: input }],
    },
    select: { id: true },
  });
  if (!docType) {
    throw badRequest("文档类型不存在或已停用");
  }
  return docType.id;
}
