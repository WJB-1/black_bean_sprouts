import "dotenv/config";

process.env["NODE_ENV"] = process.env["NODE_ENV"] || "test";

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const [{ buildApp }, { prisma }] = await Promise.all([
    import("../../packages/server/src/app.ts"),
    import("../../packages/server/src/lib/prisma.ts"),
  ]);

  const suffix = Date.now().toString();
  const userPhone = `smoke-patch-${suffix}`;
  let app: Awaited<ReturnType<typeof buildApp>> | null = null;
  let userId = "";
  let documentId = "";

  try {
    const user = await prisma.user.create({ data: { phone: userPhone, tier: "free" } });
    userId = user.id;
    await prisma.docType.upsert({
      where: { code: "thesis" },
      update: { isActive: true, name: "Thesis" },
      create: { code: "thesis", name: "Thesis", isActive: true },
    });

    app = await buildApp();
    const token = app.jwt.sign({ userId, tier: "free" });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/documents",
      headers: { authorization: `Bearer ${token}` },
      payload: { docTypeId: "thesis", title: "Patch Smoke Seed" },
    });
    assert(createResponse.statusCode === 200, `create document failed: ${createResponse.body}`);

    const createdDocument = createResponse.json();
    documentId = String(createdDocument.id);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/api/documents/${documentId}/patches`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        patches: [
          { op: "update_meta", meta: { title: "Patch Smoke Updated", subtitle: "Subtitle A" } },
          {
            op: "insert_block",
            parentId: "root",
            index: 0,
            node: {
              id: `section-${suffix}`,
              type: "section",
              attrs: { level: 1, title: "Introduction" },
              content: [],
            },
          },
        ],
      },
    });
    assert(patchResponse.statusCode === 200, `patch api failed: ${patchResponse.body}`);

    const persistedDocument = await prisma.document.findUnique({ where: { id: documentId } });
    assert(Boolean(persistedDocument), "document not found after patch");
    assert(persistedDocument?.title === "Patch Smoke Updated", "document.title was not synchronized");

    const content = persistedDocument?.content as
      | { attrs?: { title?: string; subtitle?: string }; content?: Array<{ type?: string }> }
      | undefined;
    assert(content?.attrs?.title === "Patch Smoke Updated", "content title was not updated");
    assert(content?.attrs?.subtitle === "Subtitle A", "content subtitle was not updated");
    assert(content?.content?.[0]?.type === "section", "section block was not inserted");

    console.log("PASS: document patch API smoke succeeded");
  } finally {
    if (documentId) {
      const sessions = await prisma.agentSession.findMany({
        where: { documentId },
        select: { id: true },
      });
      await prisma.renderJob.deleteMany({ where: { documentId } });
      await prisma.agentMessage.deleteMany({
        where: { sessionId: { in: sessions.map((session) => session.id) } },
      });
      await prisma.agentSession.deleteMany({ where: { documentId } });
      await prisma.document.deleteMany({ where: { id: documentId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app?.close();
    await prisma.$disconnect();
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
