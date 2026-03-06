import { findBestMatchingRepositoryRoot } from "./pathUtils";

export type RepositoryCandidate = {
  rootPath: string;
  selected?: boolean;
};

export type RepositorySelectionInputs = {
  repositories: readonly RepositoryCandidate[];
  preferredPath?: string;
  hintedPath?: string;
  activeEditorPath?: string;
  workspacePaths?: readonly string[];
};

export function selectRepositoryRoot(inputs: RepositorySelectionInputs): string | undefined {
  const { repositories } = inputs;
  if (!repositories.length) {
    return undefined;
  }

  if (repositories.length === 1) {
    return repositories[0].rootPath;
  }

  const repositoryRoots = repositories.map(repository => repository.rootPath);

  for (const candidate of [inputs.preferredPath, inputs.hintedPath]) {
    const root = candidate ? findBestMatchingRepositoryRoot(repositoryRoots, candidate) : undefined;
    if (root) {
      return root;
    }
  }

  const selected = repositories.filter(repository => repository.selected);
  if (selected.length === 1) {
    return selected[0].rootPath;
  }

  for (const candidate of [inputs.activeEditorPath, ...(inputs.workspacePaths ?? [])]) {
    const root = candidate ? findBestMatchingRepositoryRoot(repositoryRoots, candidate) : undefined;
    if (root) {
      return root;
    }
  }

  return repositories[0].rootPath;
}
