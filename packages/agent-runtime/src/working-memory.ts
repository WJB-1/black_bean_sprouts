export interface WorkingMemory {
  currentFocus?: {
    nodeId: string;
    kind: string;
  };
  collectedInfo: Record<string, unknown>;
  userPreferences: Record<string, unknown>;
  todoList: TodoItem[];
}

export interface TodoItem {
  id: string;
  task: string;
  status: "pending" | "in_progress" | "done";
  nodeId?: string;
}
