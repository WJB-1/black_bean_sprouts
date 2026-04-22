// @doc-schema-version: 1.0.0
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { DocumentPatchArraySchema, type DocumentPatch } from "@black-bean-sprouts/doc-schema";
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocumentContent } from "../../services/document.js";
import { applyPatchesToDocument } from "../../services/documentApplication.js";

const EntityId = Type.String({ minLength: 1 });
const DocumentIdParams = Type.Object({ id: EntityId });

const CreateBody = Type.Object({
  docTypeId: EntityId,
  title: Type.Optional(Type.String()),
  styleProfileId: Type.Optional(EntityId),
});

const UpdateBody = Type.Object({
  content: Type.Unknown(),
});

const PatchBody = Type.Object({
  patches: DocumentPatchArraySchema,
});

export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const user = request.user as { userId: string };
    return listDocuments(user.userId);
  });

  fastify.get("/:id", { schema: { params: DocumentIdParams } }, async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };

    try {
      return await getDocument(id, user.userId);
    } catch (error) {
      return handleNotFound(error, reply);
    }
  });

  fastify.post("/", { schema: { body: CreateBody } }, async (request) => {
    const user = request.user as { userId: string };
    const body = request.body as {
      docTypeId: string;
      title?: string;
      styleProfileId?: string;
    };

    return createDocument({
      userId: user.userId,
      docTypeId: body.docTypeId,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.styleProfileId !== undefined && { styleProfileId: body.styleProfileId }),
    });
  });

  fastify.patch("/:id", {
    schema: {
      params: DocumentIdParams,
      body: UpdateBody,
    },
  }, async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = request.body as { content: unknown };

    try {
      return await updateDocumentContent(id, user.userId, body.content);
    } catch (error) {
      return handleNotFound(error, reply);
    }
  });

  fastify.patch("/:id/patches", {
    schema: {
      params: DocumentIdParams,
      body: PatchBody,
    },
  }, async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = request.body as { patches: DocumentPatch[] };

    try {
      return await applyPatchesToDocument({
        documentId: id,
        userId: user.userId,
        patches: body.patches,
      });
    } catch (error) {
      return handleNotFound(error, reply);
    }
  });

  fastify.delete("/:id", { schema: { params: DocumentIdParams } }, async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };

    try {
      await deleteDocument(id, user.userId);
      return { success: true };
    } catch (error) {
      return handleNotFound(error, reply);
    }
  });
}

function handleNotFound(error: unknown, reply: {
  status: (statusCode: number) => { send: (body: unknown) => unknown };
}): unknown {
  if (error instanceof Error && "statusCode" in error && error.statusCode === 404) {
    return reply.status(404).send({
      error: { code: "NOT_FOUND", message: error.message },
    });
  }
  throw error;
}
