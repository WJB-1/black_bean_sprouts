import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocumentContent,
  deleteDocument,
} from "../../services/document.js";

const CreateBody = Type.Object({
  docTypeId: Type.String(),
  title: Type.Optional(Type.String()),
  styleProfileId: Type.Optional(Type.String()),
});

const UpdateBody = Type.Object({
  content: Type.Any(),
});

export default async function documentRoutes(fastify: FastifyInstance) {
  // All routes require auth
  fastify.addHook("preHandler", fastify.authenticate);

  // List
  fastify.get("/", async (request) => {
    const user = request.user as { userId: string };
    return listDocuments(user.userId);
  });

  // Get
  fastify.get("/:id", async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };
    try {
      return await getDocument(id, user.userId);
    } catch (err) {
      if (
        err instanceof Error &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 404
      ) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: err.message },
        });
      }
      throw err;
    }
  });

  // Create
  fastify.post(
    "/",
    {
      schema: { body: CreateBody },
    },
    async (request) => {
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
        ...(body.styleProfileId !== undefined && {
          styleProfileId: body.styleProfileId,
        }),
      });
    },
  );

  // Update content
  fastify.patch(
    "/:id",
    {
      schema: { body: UpdateBody },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = request.body as { content: unknown };
      try {
        return await updateDocumentContent(id, user.userId, body.content);
      } catch (err) {
        if (
          err instanceof Error &&
          "statusCode" in err &&
          (err as { statusCode: number }).statusCode === 404
        ) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: err.message },
          });
        }
        throw err;
      }
    },
  );

  // Delete
  fastify.delete("/:id", async (request, reply) => {
    const user = request.user as { userId: string };
    const { id } = request.params as { id: string };
    try {
      await deleteDocument(id, user.userId);
      return { success: true };
    } catch (err) {
      if (
        err instanceof Error &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 404
      ) {
        return reply.status(404).send({
          error: { code: "NOT_FOUND", message: err.message },
        });
      }
      throw err;
    }
  });
}
