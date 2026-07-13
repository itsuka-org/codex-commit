export const MIN_SUPPORTED_CODEX_VERSION = "0.142.3";

export type NumericVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
};

export type CodexVersionStatus = {
  executable: string;
  raw: string;
  installed?: string;
  minimum: string;
  compatible: boolean;
};

export function parseCodexVersion(output: string): NumericVersion | undefined {
  const match = output
    .trim()
    .match(/^(?:codex-cli\s+)?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\s.*)?$/u);
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
  };
}

export function formatNumericVersion(version: NumericVersion): string {
  return `${version.major}.${version.minor}.${version.patch}${version.prerelease ? `-${version.prerelease}` : ""}`;
}

export function compareVersions(left: NumericVersion, right: NumericVersion): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) {
      return left[key] < right[key] ? -1 : 1;
    }
  }
  if (left.prerelease === right.prerelease) {
    return 0;
  }
  if (left.prerelease && !right.prerelease) {
    return -1;
  }
  if (!left.prerelease && right.prerelease) {
    return 1;
  }
  return (left.prerelease ?? "").localeCompare(right.prerelease ?? "");
}

export function isSupportedCodexVersion(version: NumericVersion): boolean {
  const minimum = parseCodexVersion(MIN_SUPPORTED_CODEX_VERSION);
  return Boolean(minimum && compareVersions(version, minimum) >= 0);
}
