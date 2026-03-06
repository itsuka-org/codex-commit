import * as vscode from "vscode";

export type CodexCommitConfig = {
  codexPath?: string;
  model?: string;
  effort?: string;
  promptTemplate: string;
  branchPromptTemplate: string;
  debugLog: boolean;
};

export function getCodexCommitConfig(): CodexCommitConfig {
  const config = vscode.workspace.getConfiguration("codexCommit");
  return {
    codexPath: readOptionalString(config, "codexPath"),
    model: readOptionalString(config, "model"),
    effort: readOptionalString(config, "effort"),
    promptTemplate: config.get<string>("promptTemplate", ""),
    branchPromptTemplate: config.get<string>("branchPromptTemplate", ""),
    debugLog: config.get<boolean>("debugLog", false)
  };
}

function readOptionalString(config: vscode.WorkspaceConfiguration, key: string): string | undefined {
  const value = config.get<string>(key, "").trim();
  return value ? value : undefined;
}
