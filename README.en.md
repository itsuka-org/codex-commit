# Codex Commit Message

A VS Code extension that generates commit messages and branch names from your Git diff.

## Features

- Generate commit messages from staged diffs
- Generate branch names from tracked staged + unstaged diffs
- Show a dedicated branch input area in SCM when the branch button is pressed
- Create the branch from the dedicated input area using the `Create Branch` action button (the standard SCM button)
- Reuse model (`codexCommit.model`) and effort (`codexCommit.effort`) settings for both commit and branch generation
- Add action buttons to the Source Control title bar
- Check `codex` PATH and authentication status with a diagnostics command

## Requirements

- The `codex` CLI must be available
- You must already be logged in with `codex login`, or have `CODEX_API_KEY` / `OPENAI_API_KEY` configured

### Notes for WSL

The extension runs in the **WSL extension host**. It will not work unless `codex` is visible from the WSL environment.
If you installed it with `nvm`, using `~/.vscode-server/server-env-setup` is the most reliable option.

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

## Usage

### Generate a Commit Message

1. Stage your changes
2. Click the ✨ button at the top right of Source Control
3. The generated message will be inserted into the commit input box

### Generate and Create a Branch Name

1. Prepare staged and/or unstaged changes
2. Click the branch button at the top right of Source Control
3. A dedicated branch input area appears in SCM
4. After Codex responds, the generated branch name appears in that input area
5. Edit it if needed, then create the branch with the `Create Branch` action button
6. VS Code automatically switches to the new branch

If multiple Git trees or worktrees are shown in SCM, the target repository is resolved in the following priority order:

1. The target repo confirmed by the most recent branch generation
2. The SCM tree where the command was executed
3. The Git repository currently selected in SCM
4. The Git repository that contains the active editor
5. The Git repository that corresponds to the workspace folder
6. The first Git repository

You can run `Codex Commit: Diagnostics` from the command palette to view diagnostic logs.

## Extension Settings

- `codexCommit.codexPath`
  Execution path for the `codex` CLI. If empty, it is resolved from PATH.

- `codexCommit.promptTemplate`
  Prompt template for commit message generation. `{{diff}}` is replaced with the staged diff.

- `codexCommit.branchPromptTemplate`
  Prompt template for branch name generation. `{{diff}}` is replaced with the staged + unstaged diff.

- `codexCommit.model`
  Model name passed to `codex exec --model` (selectable from the settings UI). If unset, the default behavior of the `codex` CLI is used.
  Each model description in Settings also lists the available effort values.

- `codexCommit.effort`
  Effort passed to `codex exec -c model_reasoning_effort=...`. If unset (empty string), no effort is passed and the default behavior of the `codex` CLI / model is used.

- `codexCommit.debugLog`
  Outputs debug logs to the `Codex Commit` output channel.

## Commands

- `Generate Commit Message (codex)` (`codexCommit.generate`)
- `Generate Branch Name (codex)` (`codexCommit.generateBranchName`)
- `Regenerate Branch Name (codex)` (`codexCommit.regenerateBranchName`)
- `Create Branch` (`codexCommit.createBranchFromGeneratedInput`)
- `Codex Commit: Diagnostics` (`codexCommit.diagnostics`)

## Troubleshooting

### `codex` cannot be found

- Set `codexCommit.codexPath`
- Or add `codex` to PATH via `~/.vscode-server/server-env-setup`

### Authentication errors

- Run `codex login`
- Or set `CODEX_API_KEY` / `OPENAI_API_KEY`

## License

MIT. See [LICENSE.md](LICENSE.md).
