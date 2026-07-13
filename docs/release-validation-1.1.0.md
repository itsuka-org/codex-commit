# Codex Commit 1.1.0 release validation

- 判定日: 2026-07-13
- 実施者: Codex
- リリース判定: **READY — blocker なし**

## 検証環境

| 項目 | 値 |
| --- | --- |
| Local OS | macOS 26.5.2 (25F84), arm64 |
| Node / npm | Node 26.4.0 / npm 11.17.0（型定義は Extension Host の Node 22 に固定） |
| Codex CLI | 0.142.3、ChatGPT login |
| VS Code minimum | 1.109.0, arm64 |
| VS Code stable | 1.128.0, arm64 |
| Remote | Dev Container, Debian arm64, Git 2.47.3, Docker Desktop 4.80.0 / Engine 29.6.1 |

## 自動検証

| 検証 | 結果 |
| --- | --- |
| `npm ci` | 成功、507 packages、0 vulnerabilities |
| compile / lint | 成功、警告なし |
| unit 単独 | 73 passing、pending / skip なし |
| VS Code 1.109.0 | 3 passing: activation、5 command、rooted SCM、設定移行と scope |
| VS Code 1.128.0 | 3 passing: 同上 |
| `npm test` | compile / lint / unit / minimum / stable の全順序で成功 |
| `npm audit` / `npm audit --omit=dev` | いずれも 0 vulnerabilities |
| `git diff --check` | 成功 |
| 残存コード監査 | system Git spawn、JSONL parser、TUI fallback、auth preflight、旧 Codex flag なし |

Codex version fixture は 0.142.2 / 0.142.3 / 0.142.4 / 0.143.0 / 1.0.0、前後空白、prerelease、parse 不可、command not found を含む。非対応版では exec を呼ばず、対応版の version check は executable path ごとに cache され、path 変更後は再検査される。

## VSIX

| 項目 | 値 |
| --- | --- |
| Filename | `codex-commit-1.1.0.vsix` |
| Compressed | 65,317 bytes |
| Uncompressed | 126,666 bytes |
| Files | 34 |
| Budget | 500 KiB 未満、100 files 未満 — 合格 |

VSIX には manifest、5 commands、README 日英、CHANGELOG、LICENSE、icon、runtime JS のみを収録する。source、test、plan、docs、source map、runtime dependency は含まれず、`verify:vsix` が required / forbidden contents と size を検査した。

## 手動・統合確認

### macOS local / install 済み VSIX

- 空の user-data / extensions profile に生成 VSIX を install し、`itsukaorg.codex-commit@1.1.0` を確認した。
- Settings UI は新しい6設定だけを model、effort、commit prompt、branch prompt、Codex path、debug log の順で表示し、旧 ID は contribution されない。
- 旧設定だけの upgrade fixture、新旧の優先規則、明示的な空文字、User / Workspace / Workspace Folder の優先順位を VS Code 1.109.0 / 1.128.0 の実 Extension Host で確認した。
- 実 Codex CLI 0.142.3、`gpt-5.4-mini` / low で staged diff から `chore: add updated sample output` を Git SCM input に反映した。
- 同じ実 CLI で `feat/add-after-line` を生成し、専用の repository-rooted SourceControl から標準 Cmd+Enter を1回実行して、対象 repository に同名 branch が1本だけ作成された。
- deterministic fake Codex でも commit / branch 両経路、button、standard SCM accept、diagnostics を確認した。
- icon、README、5 commands、diagnostics が install 済み VSIX から利用でき、Extension Host log に uncaught rejection、missing module、dispose error はなかった。

### Dev Container

- VSIX を workspace extension として `/root/.vscode-server/extensions/itsukaorg.codex-commit-1.1.0` に配置し、built-in Git API が1 repository を返すことを確認した。
- diagnostics は `extension host: dev-container`、`cwd: /workspaces/codex-commit-remote-smoke`、Codex not found、Git enabled を報告した。
- Container に Codex がない場合は extension host environment 向けの一般案内になり、WSL 文言は出なかった。`remoteName === "wsl"` だけに WSL hint を追加する条件は unit test で固定した。
- Source Control / command palette の action と diagnostics を実行し、remote Extension Host log に uncaught error はなかった。
- 検証後に container、profile、repository を削除し、検証前は停止していた Docker Desktop も終了した。

## 警告と未解決事項

| Severity | 内容 / 影響 | 判定 |
| --- | --- | --- |
| Low | `npm ci` の deprecated warning は `@vscode/test-cli -> c8 -> test-exclude` と `@vscode/vsce -> cheerio/keytar` の dev-only transitive dependency。runtime dependency は0、audit は0件。 | upstream toolchain の更新待ち。リリース可 |
| Low | npm 11 の install-script review warning は `@vscode/vsce-sign`、optional `keytar` / `fsevents` の開発ツールだけが対象。 | 配布 VSIX には含まれない。リリース可 |
| Low | VS Code CLI の VSIX install 時に upstream の `url.parse()` deprecation warning が出る。 | 拡張 runtime 外。リリース可 |
| Low | 手元の Codex 0.142.3 では user config の `gpt-5.6-sol` がより新しい CLI を要求した。`gpt-5.4-mini` では実生成成功。 | README に model ごとの追加要件を明記。CLI 更新または対応 model 選択で回避。リリース可 |
| Low | user-installed Computer Use plugin の通知 helper が Codex 終了後も pipe を保持するケースを再現した。 | ProcessRunner は exit 後の drain 猶予で完了し、直接 child を管理・解放する。外部 helper は検証後に削除。リリース可 |

未解決 blocker はない。

## 移行 fallback の追跡

- 追跡 ID: `MIGRATION-001`
- 対象: `codexCommit.promptTemplate` / `codexCommit.branchPromptTemplate` の読み取り fallback 利用状況と問い合わせ
- 観測期間: 1.1.x を少なくとも1リリース期間
- 削除可能な最短 release: **1.2.0**。削除前に README / CHANGELOG で告知し、観測結果を再確認する。
