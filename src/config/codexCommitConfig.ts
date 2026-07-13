import * as vscode from "vscode";
import { readMigratedSetting } from "./configMigration";

export type CodexCommitConfig = {
  codexPath?: string;
  model?: string;
  effort?: string;
  commitMessagePromptTemplate: string;
  branchNamePromptTemplate: string;
  debugLog: boolean;
};

export function getCodexCommitConfig(resource?: vscode.Uri): CodexCommitConfig {
  const config = vscode.workspace.getConfiguration("codexCommit", resource);
  return {
    codexPath: readOptionalString(config, "codexPath"),
    model: readOptionalString(config, "model"),
    effort: readOptionalString(config, "effort"),
    commitMessagePromptTemplate: readMigratedSetting(
      config,
      "commitMessagePromptTemplate",
      "promptTemplate",
      ""
    ),
    branchNamePromptTemplate: readMigratedSetting(
      config,
      "branchNamePromptTemplate",
      "branchPromptTemplate",
      ""
    ),
    debugLog: config.get<boolean>("debugLog", false)
  };
}

function readOptionalString(config: vscode.WorkspaceConfiguration, key: string): string | undefined {
  const value = config.get<string>(key, "").trim();
  return value ? value : undefined;
}
