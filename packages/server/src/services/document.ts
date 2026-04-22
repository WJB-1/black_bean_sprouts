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
    throw notFound("Document not found");
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
  const emptyDoc = createEmptyDoc(data.title);

  return prisma.document.create({
    data: {
      userId: data.userId,
      docTypeId: resolvedDocTypeId,
      ...(data.styleProfileId !== undefined && { styleProfileId: data.styleProfileId }),
      title: emptyDoc.attrs.title,
      content: emptyDoc as unknown as Prisma.InputJsonValue,
      meta: emptyDoc.attrs as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updateDocumentContent(id: string, userId: string, content: unknown) {
  const document = await getDocument(id, userId);
  if (!isValidDoc(content)) {
    throw badRequest("Document content is not a valid Doc AST");
  }

  return prisma.document.update({
    where: { id: document.id },
    data: {
      title: content.attrs.title,
      meta: content.attrs as unknown as Prisma.InputJsonValue,
      content: content as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function deleteDocument(id: string, userId: string) {
  const document = await getDocument(id, userId);
  await prisma.document.delete({ where: { id: document.id } });
}

function createEmptyDoc(title?: string): Doc {
  return {
    type: "doc",
    schemaVersion: "1.0.0",
    attrs: {
      title: title?.trim() || "Untitled Document",
      authors: [],
      docLanguage: "zh",
    },
    content: [],
    references: {},
    assets: {},
    footnotes: {},
  };
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
    throw badRequest("Document type does not exist or is inactive");
  }
  return docType.id;
}
