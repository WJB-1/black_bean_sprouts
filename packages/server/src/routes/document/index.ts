import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocumentContent,
} from "../../services/document.js";

const EntityId = Type.String({ minLength: 1 });

const CreateBody = Type.Object({
  docTypeId: EntityId,
  title: Type.Optional(Type.String()),
  styleProfileId: Type.Optional(EntityId),
});

const UpdateBody = Type.Object({
  content: Type.Unknown(),
});

const DocumentIdParams = Type.Object({
  id: EntityId,
});

export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/", async (request) => {
    const user = request.user as { userId: string };
    return listDocuments(user.userId);
  });

  fastify.get(
    "/:id",
    { schema: { params: DocumentIdParams } },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };

      try {
        return await getDocument(id, user.userId);
      } catch (err) {
        if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 404) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: err.message },
          });
        }
        throw err;
      }
    },
  );

  fastify.post(
    "/",
    { schema: { body: CreateBody } },
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

  fastify.patch(
    "/:id",
    {
      schema: {
        params: DocumentIdParams,
        body: UpdateBody,
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };
      const body = request.body as { content: unknown };

      try {
        return await updateDocumentContent(id, user.userId, body.content);
      } catch (err) {
        if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 404) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: err.message },
          });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    "/:id",
    { schema: { params: DocumentIdParams } },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { id } = request.params as { id: string };

      try {
        await deleteDocument(id, user.userId);
        return { success: true };
      } catch (err) {
        if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 404) {
          return reply.status(404).send({
            error: { code: "NOT_FOUND", message: err.message },
          });
        }
        throw err;
      }
    },
  );
}
