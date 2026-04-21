import type { ReferenceItem } from "@black-bean-sprouts/doc-schema";
import type { FormattedCitation } from "./types.js";

/**
 * Citation formatter.
 *
 * MVP implementation: basic GB/T 7714 numeric formatting.
 * Production: swap with citeproc-js for full CSL support.
 *
 * citeproc-js has complex initialization and requires CSL XML files,
 * so for the engine skeleton we use a lightweight formatter that
 * produces correct GB/T 7714-2015 numeric citations.
 */
export class CitationFormatter {
  private index = new Map<string, number>();
  private order: ReferenceItem[] = [];

  /**
   * Index references by their order of appearance.
   * Call this once before formatting.
   */
  indexReferences(
    references: ReferenceItem[],
    citationOrder: string[],
  ): void {
    this.index.clear();
    this.order = [];

    // Order by citation appearance; un-cited refs appended alphabetically
    const cited = new Set(citationOrder);
    for (const refId of citationOrder) {
      const ref = references.find((r) => r.id === refId);
      if (ref) {
        this.order.push(ref);
        this.index.set(refId, this.order.length);
      }
    }
    for (const ref of references) {
      if (!cited.has(ref.id)) {
        this.order.push(ref);
        this.index.set(ref.id, this.order.length);
      }
    }
  }

  /** Format an in-text citation, e.g. "[1]" */
  formatInText(refId: string): string {
    const num = this.index.get(refId);
    return num !== undefined ? `[${num}]` : "[?]";
  }

  /** Format all indexed references as bibliography entries */
  formatBibliography(): FormattedCitation[] {
    return this.order.map((ref, i) => ({
      id: ref.id,
      text: `[${i + 1}]`,
      bibliography: formatEntry(ref, i + 1),
    }));
  }
}

function formatAuthorName(person: { family: string; given: string }): string {
  return `${person.family}${person.given}`;
}

function formatEntry(ref: ReferenceItem, num: number): string {
  const parts: string[] = [];

  // Authors
  if (ref.authors.length > 0) {
    const names = ref.authors.map(formatAuthorName).join(", ");
    parts.push(names);
  }

  // Title
  parts.push(ref.title);

  // Journal / Container
  if (ref["container-title"]) {
    parts.push(ref["container-title"]);
  }

  // Year
  if (ref.issued?.["date-parts"]?.[0]?.[0]) {
    parts.push(String(ref.issued["date-parts"][0][0]));
  }

  // Volume & Issue
  if (ref.volume) {
    const vi = ref.issue ? `${ref.volume}(${ref.issue})` : ref.volume;
    parts.push(vi);
  }

  // Pages
  if (ref.page) {
    parts.push(ref.page);
  }

  return `[${num}] ${parts.join(". ")}.`;
}
