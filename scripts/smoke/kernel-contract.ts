import { createFakeOpenClawKernel, createKernelRuntime } from "@black-bean-sprouts/xiaolongxia-kernel";
async function main() {
  console.log("test:kernel-contract - Testing kernel contract...");
  const fake = createFakeOpenClawKernel();
  const runtime = createKernelRuntime(fake);
  let count = 0;
  for await (const e of runtime.run({ message: "test" })) { count++; }
  if (count < 2) { console.error("FAIL: too few events"); process.exit(1); }
  console.log("PASS: kernel contract satisfied, " + count + " events");
}
main().catch(e => { console.error(e); process.exit(1); });
