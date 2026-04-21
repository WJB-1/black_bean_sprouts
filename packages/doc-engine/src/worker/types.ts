/** Payload for a render job */
export interface RenderJobPayload {
  documentId: string;
  format: "docx" | "pdf";
  styleProfileId: string;
}

/** Result of a completed render job */
export interface RenderJobResult {
  jobId: string;
  storageKey: string;
  format: string;
  size: number;
}
