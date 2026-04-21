export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message: string): AppError {
  return new AppError(404, message, "NOT_FOUND");
}

export function unauthorized(message = "未授权"): AppError {
  return new AppError(401, message, "UNAUTHORIZED");
}

export function badRequest(message: string): AppError {
  return new AppError(400, message, "BAD_REQUEST");
}

export function forbidden(message = "无权限"): AppError {
  return new AppError(403, message, "FORBIDDEN");
}
