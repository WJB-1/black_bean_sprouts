/** Number assigned to a node */
export interface NodeNumber {
  nodeId: string;
  display: string;        // "图 3-2" "2.1.3" "(1.5)"
  plainNumber: string;    // "3-2" "2.1.3" "1.5"
}

/** Context tracking counters during AST walk */
export interface NumberingCounters {
  section: number[];
  figure: number;
  table: number;
  formula: number;
  appendix: number;
  reference: number;
}
