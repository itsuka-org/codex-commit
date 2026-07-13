# Codex Commit Message

Git の差分からコミットメッセージやブランチ名を生成する VS Code 拡張です。

## Features

- ステージ済み差分からコミットメッセージを生成
- staged + unstaged の tracked 差分からブランチ名を生成
- ブランチ名ボタン押下で SCM に専用のブランチ入力エリアを表示
- 専用入力エリアでは `Create Branch` アクションボタン（SCM標準ボタン）で作成実行
- モデル設定 (`codexCommit.model`) と Effort 設定 (`codexCommit.effort`) をコミット生成/ブランチ生成で共通利用
- Source Control タイトルバーに実行ボタンを追加
- 生成は明示的な read-only sandbox と ephemeral session で実行され、キャンセル可能
- 診断コマンドで `codex` の version/PATH/認証状態と Git 拡張状態を確認

## Requirements

- `codex` CLI **0.142.3 以上** が利用可能であること
- `codex login` 済み、または `CODEX_API_KEY` / `OPENAI_API_KEY` が設定済みであること

拡張は Workspace Extension として、開いている workspace と同じ Extension Host で動作します。ローカル workspace ではローカル、WSL / SSH / Dev Container では remote 側で、組み込み Git API と `codex` executable を解決します。

### WSL 利用時の注意

WSL workspace では **WSL の拡張ホスト**で動作します。WSL の環境変数に `codex` が見えないと動きません。
nvm でインストールしている場合は `~/.vscode-server/server-env-setup` を使うのが確実です。

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

## Usage

### Commit Message を生成する

1. 変更をステージする
2. Source Control 右上の ✨ ボタンをクリック
3. コミット入力欄にメッセージが入る

### Branch Name を生成して作成する

1. staged / unstaged の変更を用意する
2. Source Control 右上のブランチボタンをクリック
3. SCM に専用のブランチ入力エリアが表示される
4. Codex 応答後、専用入力エリアにブランチ名が表示される
5. 必要なら編集し、標準 SCM accept（Ctrl+Enter / Cmd+Enter）または「Create Branch」アクションボタンでブランチを作成
6. 新規ブランチへ自動で切り替わる

複数の Git ツリーや worktree が SCM に表示されている場合は、対象リポジトリを次の優先順位で解決します。

1. 直前の branch generation で確定した target repo
2. コマンドを実行した SCM ツリー
3. SCM で現在選択されている Git リポジトリ
4. アクティブエディタが属する Git リポジトリ
5. ワークスペースフォルダに対応する Git リポジトリ
6. 先頭の Git リポジトリ

コマンドパレットから `Codex Commit: Diagnostics` を実行すると診断ログが表示されます。

## Extension Settings

- `codexCommit.model`
  `codex exec --model` に渡すモデル名（設定画面の選択肢から選べます）。未設定の場合は `codex` CLI のデフォルトを使います。
  Settings の各モデル説明に、利用可能な effort の種類を記載しています。

- `codexCommit.effort`
  `codex exec -c model_reasoning_effort=...` に渡す effort。未設定（空文字）の場合は effort を渡さず、`codex` CLI / モデルのデフォルト動作を使います。

- `codexCommit.commitMessagePromptTemplate`
  コミットメッセージ生成のプロンプトテンプレート。`{{diff}}` が差分に置換されます。

- `codexCommit.branchNamePromptTemplate`
  ブランチ名生成のプロンプトテンプレート。`{{diff}}` が staged+unstaged 差分に置換されます。

- `codexCommit.codexPath`
  Extension Host 内の `codex` CLI 実行パス。空の場合は PATH から解決します。

- `codexCommit.debugLog`
  サニタイズ済みの process diagnostics を `Codex Commit` 出力チャネルに出力します。API key の値は出力しません。

設定画面では上記の順（model、effort、commit message prompt、branch name prompt、codex path、debug log）で表示されます。
各設定は User / Workspace / Workspace Folder スコープに対応し、生成対象の Git リポジトリに最も近い値を使用します。

### Prompt 設定の移行

旧 `codexCommit.promptTemplate` / `codexCommit.branchPromptTemplate` は Settings UI には表示されませんが、少なくとも 1 リリースは読み取り fallback を維持します。新旧の値が両方ある場合は、新しい設定（空文字を明示した場合を含む）が優先されます。旧値を自動変更・削除することはありません。

### Model と effort

  | モデル | 利用可能な effort |
  | --- | --- |
  | `gpt-5.6-sol` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
  | `gpt-5.6-terra` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
  | `gpt-5.6-luna` | `low`, `medium`, `high`, `xhigh`, `max` |
  | `gpt-5.5` | `low`, `medium`, `high`, `xhigh` |
  | `gpt-5.4` | `low`, `medium`, `high`, `xhigh` |
  | `gpt-5.4-mini` | `low`, `medium`, `high`, `xhigh` |
  | `gpt-5.3-codex-spark`（ChatGPT Pro向け研究プレビュー） | `low`, `medium`, `high`, `xhigh` |

選択したモデルが対応している effort を指定してください。
Codex Commit の最小 CLI version は 0.142.3 ですが、モデル側がそれより新しい CLI を要求する場合があります。その場合は Codex CLI を更新するか、利用中の CLI に対応するモデルを選択してください。

## Commands

- `Generate Commit Message (codex)` (`codexCommit.generate`)
- `Generate Branch Name (codex)` (`codexCommit.generateBranchName`)
- `Regenerate Branch Name (codex)` (`codexCommit.regenerateBranchName`)
- `Create Branch` (`codexCommit.createBranchFromGeneratedInput`)
- `Codex Commit: Diagnostics` (`codexCommit.diagnostics`)

## Troubleshooting

### `codex` が見つからない

- `codexCommit.codexPath` を設定する
- local では local Extension Host の PATH、remote では remote Extension Host の PATH を確認する
- WSL の場合は必要に応じて `~/.vscode-server/server-env-setup` で PATH を追加する

### 認証エラーになる

- `codex login` を実行
- もしくは `CODEX_API_KEY` / `OPENAI_API_KEY` を設定

### Codex CLI が古い

`Codex Commit: Diagnostics` で installed / minimum / compatible を確認し、0.142.3 以上へ更新してください。version が非対応または解析不能な場合、生成処理は `codex exec` を開始しません。

## Development

```bash
npm ci
npm test
npm run package
npm run verify:vsix
```

## License

MIT. See [LICENSE.md](LICENSE.md).
