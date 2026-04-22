import "dotenv/config";

process.env["NODE_ENV"] = "test";
process.env["LLM_MODE"] = "mock";

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
  const userPhone = `smoke-agent-${suffix}`;
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
      payload: { docTypeId: "thesis", title: "Agent Smoke Seed" },
    });
    assert(createResponse.statusCode === 200, `create document failed: ${createResponse.body}`);
    documentId = String(createResponse.json().id);

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/agent/chat",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      payload: {
        documentId,
        skillCode: "thesis",
        message: "title: Mock Patch Thesis; section: Introduction",
      },
    });
    assert(chatResponse.statusCode === 200, `agent chat failed: ${chatResponse.body}`);

    const events = parseSse(chatResponse.body);
    assert(events.some((event) => event.type === "kernel_session"), "missing kernel_session event");
    assert(events.some((event) => event.type === "kernel_lifecycle" && event.phase === "start"), "missing kernel start event");
    assert(events.some((event) => event.type === "document_patched"), "missing document_patched event");
    assert(events.some((event) => event.type === "done"), "missing done event");

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    assert(Boolean(document), "document not found after agent chat");
    assert(document?.title === "Mock Patch Thesis", "agent patch did not sync document title");

    const content = document?.content as
      | { attrs?: { title?: string }; content?: Array<{ type?: string; attrs?: { title?: string } }> }
      | undefined;
    assert(content?.attrs?.title === "Mock Patch Thesis", "agent patch did not update content title");
    assert(content?.content?.[0]?.type === "section", "agent patch did not insert section");
    assert(content?.content?.[0]?.attrs?.title === "Introduction", "agent patch section title mismatch");

    const session = await prisma.agentSession.findFirst({
      where: { documentId, userId },
      orderBy: { createdAt: "desc" },
    });
    const kernelState = session?.workingMemory as { kernel?: { sessionKey?: string; skillsSnapshot?: string[] } } | undefined;
    assert(Boolean(kernelState?.kernel?.sessionKey), "kernel sessionKey not persisted");
    assert(Array.isArray(kernelState?.kernel?.skillsSnapshot), "kernel skillsSnapshot not persisted");

    console.log("PASS: agent patch smoke succeeded");
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

function parseSse(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .map((frame) => frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n"))
    .filter((payload) => payload.length > 0 && payload !== "[DONE]")
    .map((payload) => JSON.parse(payload) as Record<string, unknown>);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
