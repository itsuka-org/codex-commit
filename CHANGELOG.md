# Changelog

## 1.1.0

- Require the project-verified Codex CLI compatibility floor of 0.142.3.
- Run generation with an explicit read-only sandbox, ephemeral sessions, cancellation, timeout, and bounded process output.
- Create branches through the selected VS Code Git repository API and prevent stale concurrent results from changing the active session.
- Rename the prompt settings to `commitMessagePromptTemplate` and `branchNamePromptTemplate`; legacy values remain readable for at least one release and new values take precedence.
- Reduce the VSIX to runtime files and add automated content and size verification.
