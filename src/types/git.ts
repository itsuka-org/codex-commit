import * as vscode from "vscode";

export type GitExtensionExports = {
  getAPI(version: 1): GitAPI;
};

export type GitAPI = {
  repositories: Repository[];
  getRepository?(uri: vscode.Uri): Repository | null;
};

export type Repository = {
  rootUri: vscode.Uri;
  inputBox: { value: string };
  diff(cached?: boolean): Promise<string>;
  ui?: { selected?: boolean };
};

export type RepositoryResolutionContext = {
  hint?: unknown;
  preferredRoot?: string;
};
