export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "草稿",
    RENDERING: "渲染中",
    COMPLETED: "已完成",
    FAILED: "失败",
    ACTIVE: "启用",
    PENDING: "等待中",
  };

  return map[status] ?? status;
}

export function formatStatusType(
  status: string,
): "default" | "warning" | "success" | "error" {
  switch (status) {
    case "RENDERING":
    case "PENDING":
      return "warning";
    case "COMPLETED":
    case "ACTIVE":
      return "success";
    case "FAILED":
      return "error";
    default:
      return "default";
  }
}
