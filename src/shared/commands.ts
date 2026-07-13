export const COMMANDS = {
  generateCommitMessage: "codexCommit.generate",
  generateBranchName: "codexCommit.generateBranchName",
  regenerateBranchName: "codexCommit.regenerateBranchName",
  createBranch: "codexCommit.createBranchFromGeneratedInput",
  diagnostics: "codexCommit.diagnostics"
} as const;

export const COMMAND_IDS = Object.values(COMMANDS);
