import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdminRoutes } from "../../packages/server/dist/routes/admin/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const serverRequire = createRequire(path.join(repoRoot, "packages", "server", "package.json"));
const Fastify = serverRequire("fastify");
const jwt = serverRequire("@fastify/jwt");

const prisma = {
  styleProfile: {},
  docType: {},
  skill: {
    findMany: async () => [],
    create: async ({ data }) => ({ id: "fake-skill", ...data }),
    update: async ({ where, data }) => ({ id: where.id, ...data }),
  },
};

async function main() {
  console.log("smoke:project-skills-api - testing project Skill file endpoints...");
  const app = Fastify({ logger: false });
  await app.register(jwt, { secret: "test-secret" });
  await app.register(createAdminRoutes({ prisma }), { prefix: "/api/admin" });

  const token = app.jwt.sign({ role: "ADMIN" });
  const authHeaders = {
    authorization: `Bearer ${token}`,
  };
  const jsonHeaders = {
    ...authHeaders,
    "content-type": "application/json",
  };

  const listBefore = await app.inject({
    method: "GET",
    url: "/api/admin/project-skills",
    headers: authHeaders,
  });
  assert.equal(listBefore.statusCode, 200);

  const put = await app.inject({
    method: "PUT",
    url: "/api/admin/project-skills/frontend-smoke-skill",
    headers: jsonHeaders,
    payload: {
      description: "Smoke skill for frontend API validation.",
      body: "# Instructions\n\nReply in a terse frontend smoke-test style.",
    },
  });
  assert.equal(put.statusCode, 200, put.body);
  const saved = JSON.parse(put.body);
  assert.equal(saved.name, "frontend-smoke-skill");
  assert.equal(saved.description, "Smoke skill for frontend API validation.");

  const test = await app.inject({
    method: "POST",
    url: "/api/admin/project-skills/test",
    headers: jsonHeaders,
    payload: {
      skillNames: ["black-bean-sprouts-doc-agent", "frontend-smoke-skill"],
      message: "Summarize the expected output style.",
      live: false,
    },
  });
  assert.equal(test.statusCode, 200, test.body);
  const testBody = JSON.parse(test.body);
  assert.equal(testBody.results.length, 2);
  assert.match(testBody.results[0].promptPreview, /Selected skill:/u);
  assert.match(testBody.results[1].promptPreview, /frontend smoke-test style/u);

  const remove = await app.inject({
    method: "DELETE",
    url: "/api/admin/project-skills/frontend-smoke-skill",
    headers: authHeaders,
  });
  assert.equal(remove.statusCode, 200, remove.body);
  await app.close();

  console.log("PASS: project Skill file APIs support list, upsert, dry-run test, and delete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
