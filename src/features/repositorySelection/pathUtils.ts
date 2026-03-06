import * as path from "path";

export function findBestMatchingRepositoryRoot(repositoryRoots: readonly string[], targetPath: string): string | undefined {
  let bestMatch: string | undefined;

  for (const root of repositoryRoots) {
    if (!isSameOrDescendantPath(root, targetPath)) {
      continue;
    }

    if (!bestMatch || normalizeFilePath(root).length > normalizeFilePath(bestMatch).length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

export function isSameOrDescendantPath(parentPath: string, targetPath: string): boolean {
  const relativePath = path.relative(normalizeFilePath(parentPath), normalizeFilePath(targetPath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function sameFilePath(left: string, right: string): boolean {
  return normalizeFilePath(left) === normalizeFilePath(right);
}

export function normalizeFilePath(fsPath: string): string {
  const normalized = path.normalize(fsPath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
