import type { Doc, BlockNode } from "@black-bean-sprouts/doc-schema";

// ---- Public types ----

export type RenderPlan = {
  readonly mode: "full" | "incremental";
  readonly invalidatedBlockIds: readonly string[];
  readonly reason?: string;
};

export type RenderPlanInput = {
  readonly previousDoc: Doc;
  readonly currentDoc: Doc;
  readonly styleProfileChanged: boolean;
  readonly changedBlockIds: readonly string[];
};

// ---- Internal helpers ----

/**
 * Count top-level section blocks in a document.
 * Only blocks with type "section" are counted.
 */
function countSections(doc: Doc): number {
  let count = 0;
  for (const block of doc.children) {
    if (block.type === "section") {
      count++;
    }
  }
  return count;
}

/**
 * Collect all cross-reference target IDs from inline nodes inside a block tree.
 * Cross-references appear as inline nodes with type "xref".
 */
function collectXrefIds(blocks: readonly BlockNode[]): ReadonlySet<string> {
  const ids = new Set<string>();

  function walkInlines(
    inlines: readonly import("@black-bean-sprouts/doc-schema").InlineNode[]
  ): void {
    for (const inline of inlines) {
      if (inline.type === "xref") {
        ids.add(inline.targetId);
      }
    }
  }

  function walkBlock(block: BlockNode): void {
    switch (block.type) {
      case "paragraph":
        walkInlines(block.children);
        break;
      case "heading":
        walkInlines(block.children);
        break;
      case "figure":
        if (block.caption) walkInlines(block.caption);
        break;
      case "table":
        if (block.caption) walkInlines(block.caption);
        for (const row of block.rows) {
          for (const cell of row.cells) {
            for (const para of cell.children) {
              walkInlines(para.children);
            }
          }
        }
        if (block.headerRow) {
          for (const cell of block.headerRow.cells) {
            for (const para of cell.children) {
              walkInlines(para.children);
            }
          }
        }
        break;
      case "formula":
        if (block.caption) walkInlines(block.caption);
        break;
      case "abstract":
        for (const para of block.children) {
          walkInlines(para.children);
        }
        break;
      case "section":
        for (const child of block.children) {
          walkBlock(child);
        }
        break;
      case "reference-list":
        // Reference lists do not contain xref inlines
        break;
    }
  }

  for (const block of blocks) {
    walkBlock(block);
  }

  return ids;
}

/**
 * Build a map from block ID to heading level for all heading blocks.
 */
function collectHeadingLevels(
  blocks: readonly BlockNode[]
): ReadonlyMap<string, number> {
  const map = new Map<string, number>();

  function walk(block: BlockNode): void {
    if (block.type === "heading") {
      map.set(block.id, block.level);
    } else if (block.type === "section") {
      for (const child of block.children) {
        walk(child);
      }
    }
  }

  for (const block of blocks) {
    walk(block);
  }
  return map;
}

/**
 * Check if any heading block changed its level between the two documents.
 */
function headingLevelsChanged(prev: Doc, curr: Doc): boolean {
  const prevLevels = collectHeadingLevels(prev.children);
  const currLevels = collectHeadingLevels(curr.children);

  if (prevLevels.size !== currLevels.size) {
    return true;
  }

  for (const [id, level] of currLevels) {
    const prevLevel = prevLevels.get(id);
    if (prevLevel === undefined || prevLevel !== level) {
      return true;
    }
  }

  return false;
}

/**
 * Check if cross-references changed between documents.
 */
function xrefsChanged(prev: Doc, curr: Doc): boolean {
  const prevIds = collectXrefIds(prev.children);
  const currIds = collectXrefIds(curr.children);

  if (prevIds.size !== currIds.size) {
    return true;
  }

  for (const id of currIds) {
    if (!prevIds.has(id)) {
      return true;
    }
  }

  return false;
}

// ---- Main planner ----

export class RenderPlanner {
  plan(input: RenderPlanInput): RenderPlan {
    const { previousDoc, currentDoc, styleProfileChanged, changedBlockIds } =
      input;

    // Rule 1: Global style changes force full render
    if (styleProfileChanged) {
      return {
        mode: "full",
        invalidatedBlockIds: allBlockIds(currentDoc),
        reason: "Style profile changed — global style requires full re-render",
      };
    }

    // Rule 2: Numbering changes (section count changed)
    const prevSectionCount = countSections(previousDoc);
    const currSectionCount = countSections(currentDoc);
    if (prevSectionCount !== currSectionCount) {
      return {
        mode: "full",
        invalidatedBlockIds: allBlockIds(currentDoc),
        reason: `Section count changed from ${prevSectionCount} to ${currSectionCount} — numbering must be recalculated`,
      };
    }

    // Rule 3: Cross-reference changes
    if (xrefsChanged(previousDoc, currentDoc)) {
      return {
        mode: "full",
        invalidatedBlockIds: allBlockIds(currentDoc),
        reason: "Cross-references changed — full render required to update references",
      };
    }

    // Rule 4: Heading level changes (page break impact)
    if (headingLevelsChanged(previousDoc, currentDoc)) {
      return {
        mode: "full",
        invalidatedBlockIds: allBlockIds(currentDoc),
        reason: "Heading level changed — page breaks may shift, requiring full render",
      };
    }

    // Otherwise: incremental render with only affected blocks
    return {
      mode: "incremental",
      invalidatedBlockIds: changedBlockIds,
    };
  }
}

// ---- Utility ----

function allBlockIds(doc: Doc): readonly string[] {
  const ids: string[] = [];

  function walk(blocks: readonly BlockNode[]): void {
    for (const block of blocks) {
      ids.push(block.id);
      if (block.type === "section") {
        walk(block.children);
      }
    }
  }

  walk(doc.children);
  return ids;
}
