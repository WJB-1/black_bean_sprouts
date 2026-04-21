import type { Doc, StyleProfile } from "@black-bean-sprouts/doc-schema";
import { DocxRenderer } from "../renderer/docx-renderer.js";
import type { RenderOptions } from "../renderer/types.js";
import type { RenderJobPayload, RenderJobResult } from "./types.js";

export class RenderWorker {
  private renderer = new DocxRenderer();

  async render(
    doc: Doc,
    styleProfile: StyleProfile,
    loadAsset: (key: string) => Promise<Buffer>,
  ): Promise<Buffer> {
    const options: RenderOptions = {
      styleProfile,
      numberingResolver: null as unknown as RenderOptions["numberingResolver"],
      citationFormatter: null as unknown as RenderOptions["citationFormatter"],
      loadAsset,
    };

    return this.renderer.render(doc, options);
  }
}
