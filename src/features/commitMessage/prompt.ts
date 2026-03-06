export function buildPromptFromTemplate(template: string, diff: string, fallbackHeader: string): string {
  const token = "{{diff}}";
  if (!template) {
    return `${fallbackHeader}\n${diff}`;
  }

  if (template.includes(token)) {
    return template.split(token).join(diff);
  }

  return `${template}\n\n${fallbackHeader}\n${diff}`;
}

export function buildCommitPrompt(template: string, diff: string): string {
  return buildPromptFromTemplate(template, diff, "Staged diff:");
}

export function buildBranchPrompt(template: string, diff: string): string {
  return buildPromptFromTemplate(template, diff, "Diff:");
}
