import * as vscode from "vscode";
import {
  GitExtensionGateway,
  RepositoryUnavailableError
} from "../../infrastructure/git/gitExtensionGateway";
import type { UiAdapter } from "../../shared/ui";
import type { GitAPI, Repository, RepositoryResolutionContext } from "../../types/git";
import { sameFilePath } from "./pathUtils";
import { selectRepositoryRoot } from "./selection";

type UriLike =
  | vscode.Uri
  | string
  | { scheme: string; path: string }
  | { rootUri?: UriLike; resourceUri?: UriLike; uri?: UriLike };

export interface RepositoryResolverPort {
  resolve(context?: RepositoryResolutionContext): Promise<Repository | undefined>;
  resolveExact(rootUri: vscode.Uri): Promise<Repository | undefined>;
}

export class RepositoryResolver implements RepositoryResolverPort {
  constructor(
    private readonly gateway: GitExtensionGateway,
    private readonly ui: UiAdapter
  ) {}

  async resolve(context: RepositoryResolutionContext = {}): Promise<Repository | undefined> {
    const git = await this.getApiOrNotify();
    if (!git) {
      return undefined;
    }

    const repository = this.pickRepository(git, context);
    if (!repository) {
      this.ui.showWarningMessage("No Git repository found in this workspace.");
    }
    return repository;
  }

  async resolveExact(rootUri: vscode.Uri): Promise<Repository | undefined> {
    const git = await this.getApiOrNotify();
    if (!git) {
      return undefined;
    }

    const fromApi = this.tryGetRepository(git, rootUri);
    const repository = fromApi && sameFilePath(fromApi.rootUri.fsPath, rootUri.fsPath)
      ? fromApi
      : git.repositories.find(candidate => sameFilePath(candidate.rootUri.fsPath, rootUri.fsPath));
    if (!repository) {
      this.ui.showErrorMessage(
        "The Git repository selected during generation is no longer open. Reopen it and regenerate the branch name."
      );
    }
    return repository;
  }

  private async getApiOrNotify(): Promise<GitAPI | undefined> {
    try {
      return await this.gateway.getApi();
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) {
        this.ui.showErrorMessage(error.message);
        return undefined;
      }
      throw error;
    }
  }

  private pickRepository(git: GitAPI, context: RepositoryResolutionContext): Repository | undefined {
    const repositories = git.repositories;
    if (!repositories.length) {
      return undefined;
    }

    const hintedUri = this.asUri(context.hint);
    for (const uri of [context.preferredRoot, hintedUri]) {
      if (uri) {
        const repository = this.tryGetRepository(git, uri);
        if (repository) {
          return repository;
        }
      }
    }

    const selected = repositories.filter(repository => repository.ui?.selected);
    if (selected.length === 1) {
      return selected[0];
    }

    const activeEditorUri = this.getActiveEditorUri();
    if (activeEditorUri) {
      const repository = this.tryGetRepository(git, activeEditorUri);
      if (repository) {
        return repository;
      }
    }

    const workspaceUris = this.getWorkspaceUris(activeEditorUri);
    for (const uri of workspaceUris) {
      const repository = this.tryGetRepository(git, uri);
      if (repository) {
        return repository;
      }
    }

    const selectedRoot = selectRepositoryRoot({
      repositories: repositories.map(repository => ({
        rootPath: repository.rootUri.fsPath,
        selected: repository.ui?.selected
      })),
      preferredPath: context.preferredRoot?.fsPath,
      hintedPath: hintedUri?.scheme === "file" ? hintedUri.fsPath : undefined,
      activeEditorPath: activeEditorUri?.scheme === "file" ? activeEditorUri.fsPath : undefined,
      workspacePaths: workspaceUris.filter(uri => uri.scheme === "file").map(uri => uri.fsPath)
    });

    return selectedRoot
      ? repositories.find(repository => sameFilePath(repository.rootUri.fsPath, selectedRoot))
      : undefined;
  }

  private tryGetRepository(git: GitAPI, uri: vscode.Uri): Repository | undefined {
    try {
      return git.getRepository(uri) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private asUri(value: unknown, depth = 0, seen = new WeakSet<object>()): vscode.Uri | undefined {
    if (depth > 4 || !isUriLike(value)) {
      return undefined;
    }
    if (value instanceof vscode.Uri) {
      return value;
    }
    if (typeof value === "string") {
      return vscode.Uri.file(value);
    }
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);

    if ("scheme" in value && "path" in value) {
      try {
        return vscode.Uri.from(value);
      } catch {
        return undefined;
      }
    }

    return (
      this.asUri(value.rootUri, depth + 1, seen) ??
      this.asUri(value.resourceUri, depth + 1, seen) ??
      this.asUri(value.uri, depth + 1, seen)
    );
  }

  private getActiveEditorUri(): vscode.Uri | undefined {
    return vscode.window.activeTextEditor?.document.uri;
  }

  private getWorkspaceUris(activeEditorUri?: vscode.Uri): vscode.Uri[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const activeFolder = activeEditorUri ? vscode.workspace.getWorkspaceFolder(activeEditorUri)?.uri : undefined;
    const uris = activeFolder ? [activeFolder, ...folders.map(folder => folder.uri)] : folders.map(folder => folder.uri);
    return uris.filter(
      (candidate, index) => uris.findIndex(existing => existing.toString() === candidate.toString()) === index
    );
  }
}

function isUriLike(value: unknown): value is UriLike {
  if (!value) {
    return false;
  }
  if (value instanceof vscode.Uri || typeof value === "string") {
    return true;
  }
  if (typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (typeof candidate.scheme === "string" && typeof candidate.path === "string") ||
    "rootUri" in candidate ||
    "resourceUri" in candidate ||
    "uri" in candidate
  );
}
