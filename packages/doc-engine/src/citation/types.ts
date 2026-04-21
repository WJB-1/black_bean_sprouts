/** A cluster of citations that appear together, e.g. [1-3] */
export interface CitationCluster {
  citationIds: string[];
  prefix?: string;
  suffix?: string;
}

/** Formatted output for a single citation */
export interface FormattedCitation {
  id: string;
  text: string; // "[1]" or "(Smith, 2020)"
  bibliography: string; // full bibliography entry
}
