import type { StyleProfile } from "@black-bean-sprouts/doc-schema";
import type { NumberingResolver } from "../numbering/index.js";
import type { CitationFormatter } from "../citation/index.js";

export interface RenderOptions {
  styleProfile: StyleProfile;
  numberingResolver: NumberingResolver;
  citationFormatter: CitationFormatter;
  /** Load asset binary by storageKey, return Buffer */
  loadAsset: (storageKey: string) => Promise<Buffer>;
}

export interface RendererContext {
  options: RenderOptions;
  style: StyleProfile;
  numbering: NumberingResolver;
  citation: CitationFormatter;
}
