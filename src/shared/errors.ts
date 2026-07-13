export type ErrorDetails = {
  message: string;
  code?: string;
  cause?: unknown;
};

export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; cause?: unknown };
    return {
      message: error.message || error.name,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      cause: candidate.cause
    };
  }

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    return {
      message: typeof candidate.message === "string" ? candidate.message : String(error),
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      cause: candidate.cause
    };
  }

  return { message: String(error) };
}

export function summarizeErrorOutput(text: string): string {
  const firstLine = text
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Unknown error";
  }

  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine;
}
