// @doc-schema-version: 1.0.0
import type { Person } from "./resource/person";

export interface DocMeta {
  title: string;
  subtitle?: string;
  authors: Person[];
  institution?: string;
  department?: string;
  advisor?: Person;
  date?: string;                   // ISO date
  keywords?: string[];
  docLanguage: "zh" | "en";
  degree?: string;                 // "博士" "硕士" "学士"
  major?: string;                  // 专业
  studentId?: string;              // 学号
}
