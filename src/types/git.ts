import type * as vscode from "vscode";

export type GitExtensionExports = {
  readonly enabled: boolean;
  getAPI(version: 1): GitAPI;
};

export type GitAPI = {
  repositories: Repository[];
  getRepository(uri: vscode.Uri): Repository | null;
};

export type Repository = {
  rootUri: vscode.Uri;
  inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
  createBranch(name: string, checkout: boolean): Promise<void>;
  ui?: { selected?: boolean };
};

export type RepositoryResolutionContext = {
  hint?: unknown;
  preferredRoot?: vscode.Uri;
};
