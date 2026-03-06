export function summarizeErrorOutput(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return "Unknown error";
  }

  return firstLine.length > 220 ? `${firstLine.slice(0, 220)}…` : firstLine;
}
