# Codex Commit Message

A VS Code extension that generates commit messages and branch names from your Git diff.

## Features

- Generate commit messages from staged diffs
- Generate branch names from tracked staged + unstaged diffs
- Show a dedicated branch input area in SCM when the branch button is pressed
- Create the branch from the dedicated input area using the `Create Branch` action button (the standard SCM button)
- Reuse model (`codexCommit.model`) and effort (`codexCommit.effort`) settings for both commit and branch generation
- Add action buttons to the Source Control title bar
- Run generation in an explicit read-only sandbox with an ephemeral, cancellable session
- Check Codex version/PATH/authentication and built-in Git status with a diagnostics command

## Requirements

- Codex CLI **0.142.3 or newer** must be available 
- You must already be logged in with `codex login`, or have `CODEX_API_KEY` / `OPENAI_API_KEY` configured

This is a Workspace Extension. It resolves the built-in Git API and Codex executable in the same Extension Host as the open workspace: locally for local workspaces and remotely for WSL, SSH, or Dev Containers.

### Notes for WSL

For a WSL workspace, the extension runs in the **WSL extension host**. It will not work unless `codex` is visible from the WSL environment.
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
5. Edit it if needed, then use the standard SCM accept action (Ctrl+Enter / Cmd+Enter) or the `Create Branch` action button
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

- `codexCommit.model`
  Model name passed to `codex exec --model` (selectable from the settings UI). If unset, the Codex CLI default is used.

- `codexCommit.effort`
  Effort passed to `codex exec -c model_reasoning_effort=...`. If empty, the Codex CLI/model default is used.

- `codexCommit.commitMessagePromptTemplate`
  Prompt template for commit message generation. `{{diff}}` is replaced with the staged diff.

- `codexCommit.branchNamePromptTemplate`
  Prompt template for branch name generation. `{{diff}}` is replaced with the staged + unstaged diff.

- `codexCommit.codexPath`
  Codex CLI path in the Extension Host environment. If empty, it is resolved from PATH.

- `codexCommit.debugLog`
  Writes sanitized process diagnostics to the `Codex Commit` output channel. API key values are never logged.

Settings appear in that order: model, effort, commit message prompt, branch name prompt, Codex path, then debug log.
Every setting supports User, Workspace, and Workspace Folder scopes; generation uses the most specific value for the selected Git repository.

### Prompt setting migration

Legacy `codexCommit.promptTemplate` and `codexCommit.branchPromptTemplate` values are hidden from Settings UI but remain readable as a fallback for at least one release. If both old and new values exist, the new setting wins, including an explicitly empty value. The extension never rewrites or deletes the legacy value.

### Models and effort

  | Model | Supported effort values |
  | --- | --- |
  | `gpt-6-astra` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
  | `gpt-5.6-sol` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
  | `gpt-5.6-terra` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
  | `gpt-5.6-luna` | `low`, `medium`, `high`, `xhigh`, `max` |
  | `gpt-5.5` | `low`, `medium`, `high`, `xhigh` |
  | `gpt-5.3-codex-spark` (research preview for ChatGPT Pro) | `low`, `medium`, `high`, `xhigh` |

Select an effort value supported by the chosen model.
Codex Commit supports CLI 0.142.3 and newer, but an individual model may require a later CLI. If so, update Codex CLI or select a model supported by the installed CLI.

## Commands

- `Generate Commit Message (codex)` (`codexCommit.generate`)
- `Generate Branch Name (codex)` (`codexCommit.generateBranchName`)
- `Regenerate Branch Name (codex)` (`codexCommit.regenerateBranchName`)
- `Create Branch` (`codexCommit.createBranchFromGeneratedInput`)
- `Codex Commit: Diagnostics` (`codexCommit.diagnostics`)

## Troubleshooting

### `codex` cannot be found

- Set `codexCommit.codexPath`
- Check the local Extension Host PATH for local workspaces or the remote Extension Host PATH for remote workspaces
- For WSL, add `codex` to PATH via `~/.vscode-server/server-env-setup` when needed

### Authentication errors

- Run `codex login`
- Or set `CODEX_API_KEY` / `OPENAI_API_KEY`

### Codex CLI is too old

Run `Codex Commit: Diagnostics` and inspect installed / minimum / compatible. Update to 0.142.3 or newer. Generation does not start `codex exec` for unsupported or unparseable versions.

## Development

```bash
npm ci
npm test
npm run package
npm run verify:vsix
```

## License

MIT. See [LICENSE.md](LICENSE.md).
