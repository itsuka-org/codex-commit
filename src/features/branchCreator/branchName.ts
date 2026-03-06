import { Repository } from "../../types/git";
import { truncate } from "../../shared/strings";

export async function collectBranchDiff(repository: Repository): Promise<string | null> {
  const [stagedRaw, unstagedRaw] = await Promise.all([repository.diff(true), repository.diff(false)]);
  const staged = stagedRaw.trim();
  const unstaged = unstagedRaw.trim();

  if (!staged && !unstaged) {
    return null;
  }

  const hasBoth = Boolean(staged && unstaged);
  const stagedMax = hasBoth ? 5500 : 12000;
  const unstagedMax = hasBoth ? 5500 : 12000;
  const sections: string[] = [];

  if (staged) {
    sections.push(`Staged diff:\n${truncate(staged, stagedMax)}`);
  }
  if (unstaged) {
    sections.push(`Unstaged diff:\n${truncate(unstaged, unstagedMax)}`);
  }

  return sections.join("\n\n");
}

export function sanitizeBranchNameCandidate(raw: string): string {
  let text = raw.trim();
  if (!text) {
    return "";
  }

  text = text.replace(/^```[a-zA-Z0-9_-]*\s*/u, "");
  text = text.replace(/```$/u, "").trim();

  const lines = text
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "";
  }

  for (const line of lines) {
    let candidate = line;
    candidate = candidate.replace(/^branch(?:[\s_-]+name)?\s*[:：]\s*/iu, "");
    candidate = candidate.replace(/^[`"'*\s-]+/u, "");
    candidate = candidate.replace(/[`"'\s]+$/u, "");
    candidate = candidate.replace(/\s+/gu, "-");
    candidate = candidate.replace(/[^a-zA-Z0-9._/-]/gu, "-");
    candidate = candidate.replace(/\/+/gu, "/");
    candidate = candidate.replace(/-+/gu, "-");
    candidate = candidate.replace(/^[-/.]+|[-/.]+$/gu, "");

    const lower = candidate.toLowerCase();
    if (
      !lower ||
      lower === "branch-name" ||
      lower === "branch_name" ||
      lower === "branchname" ||
      lower === "name-of-branch"
    ) {
      continue;
    }

    return lower;
  }

  return "";
}
