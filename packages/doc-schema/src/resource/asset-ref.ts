// @doc-schema-version: 1.0.0

export interface AssetRef {
  id: string;
  kind: "image" | "chart" | "ai_generated" | "attachment";
  storageKey: string;
  mimeType: string;
  meta: {
    width?: number;
    height?: number;
    prompt?: string;
    source?: string;
    altText?: string;
  };
}
