export type PromptTokenValues = Readonly<Record<string, string>>;

export function expandPromptTemplate(
  template: string,
  tokenValues: PromptTokenValues,
  fallback?: { token: string; header: string }
): string {
  let prompt = template;
  let replacedFallbackToken = false;

  for (const [tokenName, value] of Object.entries(tokenValues)) {
    const token = `{{${tokenName}}}`;
    if (prompt.includes(token)) {
      prompt = prompt.split(token).join(value);
      if (fallback?.token === tokenName) {
        replacedFallbackToken = true;
      }
    }
  }

  if (!template) {
    return fallback ? `${fallback.header}\n${tokenValues[fallback.token] ?? ""}` : "";
  }

  if (fallback && !replacedFallbackToken) {
    return `${prompt}\n\n${fallback.header}\n${tokenValues[fallback.token] ?? ""}`;
  }

  return prompt;
}

export function buildCommitPrompt(template: string, diff: string): string {
  return expandPromptTemplate(template, { diff }, { token: "diff", header: "Staged diff:" });
}

export function buildBranchPrompt(template: string, diff: string): string {
  return expandPromptTemplate(template, { diff }, { token: "diff", header: "Diff:" });
}
