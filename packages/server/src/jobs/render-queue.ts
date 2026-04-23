import { Queue } from "bullmq";

export type RenderJobPayload = {
  jobId: string;
  documentId: string;
  userId: string;
  format: "docx" | "pdf";
};

export function createRenderQueue(connection: { host: string; port: number }): Queue<RenderJobPayload> {
  return new Queue<RenderJobPayload>("render", { connection });
}

export async function enqueueRenderJob(
  queue: Queue<RenderJobPayload>,
  payload: RenderJobPayload,
): Promise<string> {
  const job = await queue.add("render", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
  return job.id ?? payload.jobId;
}
