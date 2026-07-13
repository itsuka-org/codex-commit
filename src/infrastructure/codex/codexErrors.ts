import { summarizeErrorOutput } from "../../shared/errors";
import type { CodexVersionStatus } from "./version";

export type CodexErrorKind =
  | "not_found"
  | "incompatible_version"
  | "authentication"
  | "non_zero_exit"
  | "missing_output"
  | "empty_output"
  | "read_output";

export class CodexError extends Error {
  constructor(
    readonly kind: CodexErrorKind,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "CodexError";
  }
}

export function isCodexAuthError(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("missing credentials") ||
    normalized.includes("authentication") ||
    normalized.includes("api_key") ||
    normalized.includes("openai_api_key") ||
    normalized.includes("codex_api_key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("not logged in")
  );
}

export function buildNonZeroExitError(stderr: string, stdout: string, code: number | null, isWsl: boolean): CodexError {
  const combined = (stderr || stdout).trim();
  const summary = combined ? summarizeErrorOutput(combined) : `codex exited with code ${code ?? "unknown"}`;
  if (isCodexAuthError(combined)) {
    const environmentHint = isWsl ? " in WSL" : " in the extension host environment";
    return new CodexError(
      "authentication",
      `Codex CLI authentication failed. Run \`codex login\`${environmentHint} or set CODEX_API_KEY. Details: ${summary}`
    );
  }
  return new CodexError("non_zero_exit", `Codex CLI failed: ${summary}`);
}

export function buildVersionError(status: CodexVersionStatus): CodexError {
  const detected = status.installed ?? (status.raw.trim() || "unrecognized");
  return new CodexError(
    "incompatible_version",
    `Codex CLI ${status.minimum} or newer is required; detected ${detected}. Update Codex CLI and run Codex Commit: Diagnostics.`
  );
}
