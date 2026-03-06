export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n\n…(truncated)…`;
}

export function truncateForLog(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n…(truncated ${text.length - max} chars)`;
}

export function renderCommand(command: string, args: string[]): string {
  const quote = (part: string) => (/[^\x21-\x7E]|[\s"]/u.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part);
  return [command, ...args].map(quote).join(" ");
}
