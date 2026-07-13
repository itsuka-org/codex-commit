import * as path from "node:path";

export function findBestMatchingRepositoryRoot(
  repositoryRoots: readonly string[],
  targetPath: string,
  platform: NodeJS.Platform = process.platform
): string | undefined {
  let bestMatch: string | undefined;

  for (const root of repositoryRoots) {
    if (!isSameOrDescendantPath(root, targetPath, platform)) {
      continue;
    }

    if (!bestMatch || normalizeFilePath(root, platform).length > normalizeFilePath(bestMatch, platform).length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

export function isSameOrDescendantPath(
  parentPath: string,
  targetPath: string,
  platform: NodeJS.Platform = process.platform
): boolean {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const relativePath = pathApi.relative(
    normalizeFilePath(parentPath, platform),
    normalizeFilePath(targetPath, platform)
  );
  return relativePath === "" || (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath));
}

export function sameFilePath(left: string, right: string, platform: NodeJS.Platform = process.platform): boolean {
  return normalizeFilePath(left, platform) === normalizeFilePath(right, platform);
}

export function normalizeFilePath(fsPath: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = platform === "win32" ? path.win32.normalize(fsPath) : path.posix.normalize(fsPath);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}
