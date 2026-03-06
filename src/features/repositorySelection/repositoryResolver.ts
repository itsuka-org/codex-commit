import * as vscode from "vscode";
import { GitAPI, GitExtensionExports, Repository, RepositoryResolutionContext } from "../../types/git";
import { sameFilePath } from "./pathUtils";
import { selectRepositoryRoot } from "./selection";

type UriLike =
  | vscode.Uri
  | string
  | { scheme: string; path: string }
  | { rootUri?: UriLike; resourceUri?: UriLike; uri?: UriLike };

export class RepositoryResolver {
  async resolve(context: RepositoryResolutionContext = {}): Promise<Repository | undefined> {
    const gitExt = vscode.extensions.getExtension<GitExtensionExports>("vscode.git");
    if (!gitExt) {
      vscode.window.showErrorMessage("Built-in Git extension (vscode.git) not found.");
      return undefined;
    }

    if (!gitExt.isActive) {
      await gitExt.activate();
    }

    const git = gitExt.exports.getAPI(1);
    const repository = this.pickRepository(git, context);
    if (!repository) {
      vscode.window.showWarningMessage("No Git repository found in this workspace.");
      return undefined;
    }

    return repository;
  }

  private pickRepository(git: GitAPI, context: RepositoryResolutionContext): Repository | undefined {
    const repositories = git.repositories;
    if (!repositories.length) {
      return undefined;
    }

    const preferredPath = context.preferredRoot;
    const hintedPath = this.extractRepositoryHintPath(context.hint);
    const activeEditorPath = this.getActiveEditorPath();
    const workspacePaths = this.getWorkspacePaths(activeEditorPath);

    const selectedRoot = selectRepositoryRoot({
      repositories: repositories.map(repository => ({
        rootPath: repository.rootUri.fsPath,
        selected: repository.ui?.selected
      })),
      preferredPath,
      hintedPath,
      activeEditorPath,
      workspacePaths
    });

    if (!selectedRoot) {
      return undefined;
    }

    return repositories.find(repository => sameFilePath(repository.rootUri.fsPath, selectedRoot));
  }

  private extractRepositoryHintPath(value: unknown): string | undefined {
    const uri = this.asUri(value);
    return uri?.scheme === "file" ? uri.fsPath : undefined;
  }

  private asUri(value: unknown): vscode.Uri | undefined {
    if (!isUriLike(value)) {
      return undefined;
    }

    if (value instanceof vscode.Uri) {
      return value;
    }

    if (typeof value === "string") {
      return vscode.Uri.file(value);
    }

    if ("scheme" in value && "path" in value) {
      try {
        return vscode.Uri.from(value);
      } catch {
        return undefined;
      }
    }

    return this.asUri(value.rootUri) ?? this.asUri(value.resourceUri) ?? this.asUri(value.uri);
  }

  private getActiveEditorPath(): string | undefined {
    const uri = vscode.window.activeTextEditor?.document.uri;
    return uri?.scheme === "file" ? uri.fsPath : undefined;
  }

  private getWorkspacePaths(activeEditorPath?: string): string[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (!folders.length) {
      return [];
    }

    const activeFolder = activeEditorPath
      ? vscode.workspace.getWorkspaceFolder(vscode.Uri.file(activeEditorPath))?.uri.fsPath
      : undefined;

    const paths = activeFolder
      ? [activeFolder, ...folders.map(folder => folder.uri.fsPath)]
      : folders.map(folder => folder.uri.fsPath);

    return paths.filter((candidate, index) => paths.findIndex(existing => sameFilePath(existing, candidate)) === index);
  }
}

function isUriLike(value: unknown): value is UriLike {
  if (!value) {
    return false;
  }

  if (value instanceof vscode.Uri) {
    return true;
  }

  if (typeof value === "string") {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    ("scheme" in candidate && typeof candidate.scheme === "string" && typeof candidate.path === "string") ||
    "rootUri" in candidate ||
    "resourceUri" in candidate ||
    "uri" in candidate
  );
}
