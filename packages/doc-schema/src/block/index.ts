// @doc-schema-version: 1.0.0
import type { Section } from "./section.js";
import type { Paragraph } from "./paragraph.js";
import type { Figure } from "./figure.js";
import type { Table } from "./table.js";
import type { Formula } from "./formula.js";
import type { Cover } from "./cover.js";
import type { Abstract } from "./abstract.js";
import type { ToCPlaceholder } from "./toc.js";
import type { Acknowledgements } from "./acknowledgements.js";
import type { Declaration } from "./declaration.js";
import type { Appendix } from "./appendix.js";
import type { ReferenceListPlaceholder } from "./ref-list-placeholder.js";
import type { PageBreak } from "./page-break.js";

export type BlockNode =
  | Section | Paragraph | Figure | Table | Formula
  | Cover | Abstract | ToCPlaceholder
  | Acknowledgements | Declaration | Appendix
  | ReferenceListPlaceholder | PageBreak;

// Re-export for circular ref convenience
export type { Section, Paragraph, Figure, Table, Formula, Cover, Abstract, ToCPlaceholder, Acknowledgements, Declaration, Appendix, ReferenceListPlaceholder, PageBreak };
