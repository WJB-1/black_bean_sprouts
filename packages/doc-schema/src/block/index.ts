// @doc-schema-version: 1.0.0
import type { Section } from "./section";
import type { Paragraph } from "./paragraph";
import type { Figure } from "./figure";
import type { Table } from "./table";
import type { Formula } from "./formula";
import type { Cover } from "./cover";
import type { Abstract } from "./abstract";
import type { ToCPlaceholder } from "./toc";
import type { Acknowledgements } from "./acknowledgements";
import type { Declaration } from "./declaration";
import type { Appendix } from "./appendix";
import type { ReferenceListPlaceholder } from "./ref-list-placeholder";
import type { PageBreak } from "./page-break";

export type BlockNode =
  | Section | Paragraph | Figure | Table | Formula
  | Cover | Abstract | ToCPlaceholder
  | Acknowledgements | Declaration | Appendix
  | ReferenceListPlaceholder | PageBreak;

// Re-export for circular ref convenience
export type { Section, Paragraph, Figure, Table, Formula, Cover, Abstract, ToCPlaceholder, Acknowledgements, Declaration, Appendix, ReferenceListPlaceholder, PageBreak };
