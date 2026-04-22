// @doc-schema-version: 1.0.0
import type { Person } from "./person.js";

export type ReferenceType =
  | "article-journal" | "article" | "book" | "chapter"
  | "thesis" | "webpage" | "dataset" | "preprint"
  | "paper-conference" | "report" | "patent";

export interface ReferenceItem {
  id: string;
  type: ReferenceType;
  authors: Person[];
  editors?: Person[];
  title: string;
  subtitle?: string;
  shortTitle?: string;
  "container-title"?: string;
  "collection-title"?: string;
  issued?: { "date-parts": number[][] };
  publisher?: string;
  "publisher-place"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  "number-of-pages"?: number;
  DOI?: string;
  URL?: string;
  ISBN?: string;
  PMID?: string;
  PMCID?: string;
  abstract?: string;
  keyword?: string[];
  language?: string;
  note?: string;
}
