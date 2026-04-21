import type { Doc } from "@black-bean-sprouts/doc-schema";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";

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
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.userId !== userId) throw notFound("文档不存在");
  return doc;
}

export async function createDocument(data: {
  userId: string;
  docTypeId: string;
  title?: string;
  styleProfileId?: string;
}) {
  const emptyDoc: Doc = {
    type: "doc",
    schemaVersion: "1.0.0",
    attrs: { title: data.title ?? "未命名文档", authors: [], docLanguage: "zh" },
    content: [],
    references: {},
    assets: {},
    footnotes: {},
  };

  return prisma.document.create({
    data: {
      userId: data.userId,
      docTypeId: data.docTypeId,
      ...(data.styleProfileId !== undefined && {
        styleProfileId: data.styleProfileId,
      }),
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
  const doc = await getDocument(id, userId);
  return prisma.document.update({
    where: { id: doc.id },
    data: { content: content as Prisma.InputJsonValue },
  });
}

export async function deleteDocument(id: string, userId: string) {
  const doc = await getDocument(id, userId);
  await prisma.document.delete({ where: { id: doc.id } });
}
