// ============================================================================
// Doc AST Types — 黑豆芽文档唯一真相源 (B2)
// 所有文档写入必须走 DocumentPatchBatch (B1)
// 样式不进 AST (B3)
// ============================================================================

// ---- Block Node Types ----

export type TextMark = {
  readonly type: "bold" | "italic" | "underline" | "strikethrough" | "code" | "superscript" | "subscript";
};

export type InlineNode =
  | { readonly type: "text"; readonly text: string; readonly marks?: readonly TextMark[] }
  | { readonly type: "hardBreak" }
  | { readonly type: "citation"; readonly refId: string; readonly text?: string }
  | { readonly type: "xref"; readonly targetId: string; readonly label?: string }
  | { readonly type: "formula-inline"; readonly latex: string };

export type ParagraphBlock = {
  readonly type: "paragraph";
  readonly id: string;
  readonly children: readonly InlineNode[];
};

export type HeadingBlock = {
  readonly type: "heading";
  readonly id: string;
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: readonly InlineNode[];
};

export type FigureBlock = {
  readonly type: "figure";
  readonly id: string;
  readonly src: string;
  readonly alt?: string;
  readonly caption?: readonly InlineNode[];
  readonly width?: number;
  readonly height?: number;
};

export type TableCell = {
  readonly id: string;
  readonly colspan?: number;
  readonly rowspan?: number;
  readonly children: readonly ParagraphBlock[];
};

export type TableRow = {
  readonly id: string;
  readonly cells: readonly TableCell[];
};

export type TableBlock = {
  readonly type: "table";
  readonly id: string;
  readonly rows: readonly TableRow[];
  readonly headerRow?: TableRow;
  readonly caption?: readonly InlineNode[];
};

export type FormulaBlock = {
  readonly type: "formula";
  readonly id: string;
  readonly latex: string;
  readonly caption?: readonly InlineNode[];
};

export type ReferenceItem = {
  readonly id: string;
  readonly key: string;
  readonly authors: readonly string[];
  readonly title: string;
  readonly year?: number;
  readonly source: string;
  readonly doi?: string;
  readonly url?: string;
};

export type ReferenceListBlock = {
  readonly type: "reference-list";
  readonly id: string;
  readonly items: readonly ReferenceItem[];
};

export type AbstractBlock = {
  readonly type: "abstract";
  readonly id: string;
  readonly children: readonly ParagraphBlock[];
};

export type SectionBlock = {
  readonly type: "section";
  readonly id: string;
  readonly title: string;
  readonly children: readonly BlockNode[];
};

// Union of all block-level nodes
export type BlockNode =
  | ParagraphBlock
  | HeadingBlock
  | FigureBlock
  | TableBlock
  | FormulaBlock
  | ReferenceListBlock
  | AbstractBlock
  | SectionBlock;

// ---- Document Root ----

export type DocMetadata = {
  readonly title: string;
  readonly subtitle?: string;
  readonly institution?: string;
  readonly keywords?: readonly string[];
  readonly authors?: readonly { readonly name: string; readonly affiliation?: string }[];
};

export type Doc = {
  readonly version: number;
  readonly metadata: DocMetadata;
  readonly children: readonly BlockNode[];
};

// ---- Helper: create empty doc ----

export function createEmptyDoc(title: string): Doc {
  return {
    version: 0,
    metadata: { title },
    children: [],
  };
}

// ---- Helper: find block by id ----

export function findBlockById(doc: Doc, blockId: string): BlockNode | undefined {
  return findBlockInList(doc.children, blockId);
}

function findBlockInList(blocks: readonly BlockNode[], blockId: string): BlockNode | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    if (block.type === "section") {
      const found = findBlockInList(block.children, blockId);
      if (found) return found;
    }
  }
  return undefined;
}

// ---- Helper: find parent of block ----

export function findParentBlock(doc: Doc, blockId: string): { parent: Doc | SectionBlock; index: number } | undefined {
  const result = findParentInList(doc.children, blockId);
  if (result) return { parent: doc, ...result };
  return undefined;
}

function findParentInList(
  blocks: readonly BlockNode[],
  blockId: string
): { index: number } | undefined {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.id === blockId) return { index: i };
    if (block.type === "section") {
      const result = findParentInList(block.children, blockId);
      if (result) return result;
    }
  }
  return undefined;
}
