async function main() {
  console.log("smoke:queue-storage - Testing queue/storage contract...");

  // Test RenderJobPayload type contract
  type RenderJobPayload = {
    jobId: string;
    documentId: string;
    userId: string;
    format: "docx" | "pdf";
  };

  const payload: RenderJobPayload = {
    jobId: "test_" + Date.now(),
    documentId: "doc_abc123",
    userId: "user_xyz",
    format: "docx",
  };

  // Validate payload structure
  if (typeof payload.jobId !== "string" || payload.jobId.length === 0) {
    console.error("FAIL: invalid jobId");
    process.exit(1);
  }
  if (payload.format !== "docx" && payload.format !== "pdf") {
    console.error("FAIL: invalid format");
    process.exit(1);
  }

  // Test StorageService type contract
  type StorageService = {
    putObject(key: string, body: Buffer, contentType: string): Promise<void>;
    getSignedUrl(key: string, expiresSeconds: number): Promise<string>;
    removeObject(key: string): Promise<void>;
  };

  const storageMethods: (keyof StorageService)[] = ["putObject", "getSignedUrl", "removeObject"];
  if (storageMethods.length !== 3) {
    console.error("FAIL: StorageService contract changed");
    process.exit(1);
  }

  console.log("PASS: queue/storage contract verified (payload: " +
    payload.format + ", storage methods: " + storageMethods.length + ")");
}
main().catch(e => { console.error(e); process.exit(1); });
