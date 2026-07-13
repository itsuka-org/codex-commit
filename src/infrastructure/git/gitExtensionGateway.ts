import type * as vscode from "vscode";
import type { GitAPI, GitExtensionExports } from "../../types/git";

// Minimal subset verified against VS Code 1.109.0:
// https://github.com/microsoft/vscode/blob/1.109.0/extensions/git/src/api/git.d.ts
type GitExtension = vscode.Extension<GitExtensionExports>;

export type GitExtensionFailureReason = "not_found" | "activation" | "disabled" | "api";

export class RepositoryUnavailableError extends Error {
  constructor(
    readonly reason: GitExtensionFailureReason,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RepositoryUnavailableError";
  }
}

export class GitExtensionGateway {
  constructor(private readonly getExtension: () => GitExtension | undefined) {}

  async getApi(): Promise<GitAPI> {
    const extension = this.getExtension();
    if (!extension) {
      throw new RepositoryUnavailableError("not_found", "Built-in Git extension (vscode.git) was not found.");
    }

    let exports: GitExtensionExports;
    try {
      exports = extension.isActive ? extension.exports : await extension.activate();
    } catch (error) {
      throw new RepositoryUnavailableError("activation", "Built-in Git extension failed to activate.", {
        cause: error
      });
    }

    if (!exports.enabled) {
      throw new RepositoryUnavailableError(
        "disabled",
        "Built-in Git support is disabled. Enable the Git extension and the git.enabled setting."
      );
    }

    try {
      return exports.getAPI(1);
    } catch (error) {
      throw new RepositoryUnavailableError("api", "Built-in Git API v1 is unavailable.", { cause: error });
    }
  }
}
