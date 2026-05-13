import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const pnpmStoreDirectory = resolve(repoRoot, "node_modules", ".pnpm");
const requiredExports = ["PrismaClient", "BillingOrderStatus", "SubscriptionStatus", "RenderJobStatus"];

function resolveGeneratedClientDefinition() {
  if (!existsSync(pnpmStoreDirectory)) {
    return null;
  }

  const prismaClientPackage = readdirSync(pnpmStoreDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("@prisma+client@"))
    .map((entry) => resolve(pnpmStoreDirectory, entry.name, "node_modules", ".prisma", "client", "index.d.ts"))
    .find((candidatePath) => existsSync(candidatePath));

  return prismaClientPackage ?? null;
}

function hasRequiredExports() {
  const generatedDefinition = resolveGeneratedClientDefinition();
  if (!generatedDefinition) {
    return false;
  }

  const contents = readFileSync(generatedDefinition, "utf8");
  return requiredExports.every((exportName) => contents.includes(exportName));
}

function runPrismaGenerate() {
  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const prismaCommand = process.platform === "win32"
    ? resolve(repoRoot, "node_modules", ".bin", "prisma.cmd")
    : resolve(repoRoot, "node_modules", ".bin", "prisma");
  let result = existsSync(prismaCommand)
    ? spawnSync(prismaCommand, ["generate", "--schema=prisma/schema.prisma"], {
      cwd: repoRoot,
      stdio: "inherit",
    })
    : spawnSync(pnpmCommand, ["exec", "prisma", "generate", "--schema=prisma/schema.prisma"], {
      cwd: repoRoot,
      stdio: "inherit",
    });

  if (result.error?.code === "ENOENT") {
    result = spawnSync(
      "corepack",
      ["pnpm", "exec", "prisma", "generate", "--schema=prisma/schema.prisma"],
      {
        cwd: repoRoot,
        stdio: "inherit",
      },
    );
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (hasRequiredExports()) {
  console.log("ensure-prisma-client: existing Prisma client is ready");
  process.exit(0);
}

console.log("ensure-prisma-client: generating Prisma client...");
runPrismaGenerate();

if (!hasRequiredExports()) {
  console.error("ensure-prisma-client: Prisma client still missing required exports after generate");
  process.exit(1);
}

console.log("ensure-prisma-client: Prisma client generated successfully");
