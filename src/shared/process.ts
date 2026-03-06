export type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
};

export function formatCommandResult(result: CommandResult): string {
  if (result.error) {
    return `error: ${result.error}`;
  }

  const combined = (result.stdout || result.stderr).trim();
  if (combined) {
    return combined;
  }

  return `exit ${result.code ?? "unknown"}`;
}
