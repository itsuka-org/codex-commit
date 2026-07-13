export const DIFF_TRUNCATION_MARKER = "\n…(truncated)…";

export type DiffSection = {
  label?: string;
  content: string;
};

type PreparedSection = {
  label: string;
  content: string;
};

export function buildDiffInput(sections: readonly DiffSection[], maxCharacters: number): string {
  if (maxCharacters <= 0) {
    return "";
  }

  const prepared = sections
    .map(section => ({ label: section.label?.trim() ?? "", content: section.content.trim() }))
    .filter(section => Boolean(section.content));
  if (!prepared.length) {
    return "";
  }

  const full = renderSections(prepared);
  if (full.length <= maxCharacters) {
    return full;
  }

  if (maxCharacters <= DIFF_TRUNCATION_MARKER.length) {
    return DIFF_TRUNCATION_MARKER.slice(0, maxCharacters);
  }

  const fixedLength = renderSections(prepared.map(section => ({ ...section, content: "" }))).length;
  const contentBudget = Math.max(
    0,
    maxCharacters - fixedLength - DIFF_TRUNCATION_MARKER.length
  );
  const allocations = allocateSectionBudgets(
    prepared.map(section => section.content.length),
    contentBudget
  );

  const truncated = prepared.map((section, index) => ({
    ...section,
    content: truncateDiffPreservingHeaders(section.content, allocations[index])
  }));
  const rendered = renderSections(truncated);
  const availableBeforeMarker = maxCharacters - DIFF_TRUNCATION_MARKER.length;
  return `${rendered.slice(0, availableBeforeMarker)}${DIFF_TRUNCATION_MARKER}`;
}

export function truncateDiffPreservingHeaders(diff: string, maxCharacters: number): string {
  const value = diff.trim();
  if (maxCharacters <= 0) {
    return "";
  }
  if (value.length <= maxCharacters) {
    return value;
  }

  const files = splitDiffFiles(value);
  if (files.length === 1) {
    return value.slice(0, maxCharacters);
  }

  const headerSegments = files.map(extractFileHeader);
  const headers = fitSegments(headerSegments, maxCharacters);
  if (headers.length >= maxCharacters) {
    return headers.slice(0, maxCharacters);
  }

  const remaining = maxCharacters - headers.length - 1;
  if (remaining <= 0) {
    return headers;
  }

  const bodies = files.map((file, index) => file.slice(headerSegments[index].length).trim()).filter(Boolean);
  const body = fitSegments(bodies, remaining);
  return body ? `${headers}\n${body}`.slice(0, maxCharacters) : headers;
}

function renderSections(sections: readonly PreparedSection[]): string {
  return sections
    .map(section => (section.label ? `${section.label}:\n${section.content}` : section.content))
    .join("\n\n");
}

function allocateSectionBudgets(lengths: readonly number[], totalBudget: number): number[] {
  const allocations = lengths.map(() => 0);
  let remaining = totalBudget;
  let pending = lengths.map((length, index) => ({ length, index }));

  while (remaining > 0 && pending.length > 0) {
    const fairShare = Math.max(1, Math.floor(remaining / pending.length));
    const next: typeof pending = [];
    let spent = 0;
    for (const item of pending) {
      const available = item.length - allocations[item.index];
      const amount = Math.min(available, fairShare);
      allocations[item.index] += amount;
      spent += amount;
      if (allocations[item.index] < item.length) {
        next.push(item);
      }
    }
    if (spent === 0) {
      break;
    }
    remaining -= spent;
    pending = next;
  }

  return allocations;
}

function splitDiffFiles(diff: string): string[] {
  const starts = [...diff.matchAll(/^diff --git /gmu)].map(match => match.index ?? 0);
  if (starts.length <= 1) {
    return [diff];
  }

  return starts.map((start, index) => diff.slice(start, starts[index + 1] ?? diff.length).trim());
}

function extractFileHeader(file: string): string {
  const lines = file.split(/\r?\n/u);
  const header: string[] = [];
  for (const line of lines) {
    if (
      header.length === 0 ||
      /^(?:index |new file mode |deleted file mode |similarity index |rename (?:from|to) |--- |\+\+\+ |@@)/u.test(
        line
      )
    ) {
      header.push(line);
      if (line.startsWith("@@")) {
        break;
      }
      continue;
    }
    if (header.length > 0) {
      continue;
    }
  }
  return header.join("\n") || lines[0] || "";
}

function fitSegments(segments: readonly string[], budget: number): string {
  if (budget <= 0) {
    return "";
  }

  const selected: string[] = [];
  let remaining = budget;
  for (let index = 0; index < segments.length; index += 1) {
    const separatorLength = selected.length ? 1 : 0;
    const laterSegments = segments.length - index - 1;
    const reserve = laterSegments > 0 ? laterSegments * 2 : 0;
    const allowed = Math.max(1, remaining - separatorLength - reserve);
    const segment = segments[index].slice(0, allowed);
    if (!segment) {
      continue;
    }
    selected.push(segment);
    remaining -= separatorLength + segment.length;
    if (remaining <= 0) {
      break;
    }
  }
  return selected.join("\n").slice(0, budget);
}
