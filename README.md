# Codex Commit Message

Git の差分からコミットメッセージやブランチ名を生成する VS Code 拡張です。

## Features

- ステージ済み差分からコミットメッセージを生成
- staged + unstaged の tracked 差分からブランチ名を生成
- ブランチ名ボタン押下で SCM に専用のブランチ入力エリアを表示
- 専用入力エリアでは `Create Branch` アクションボタン（SCM標準ボタン）で作成実行
- モデル設定 (`codexCommit.model`) と Effort 設定 (`codexCommit.effort`) をコミット生成/ブランチ生成で共通利用
- Source Control タイトルバーに実行ボタンを追加
- 診断コマンドで `codex` の PATH/認証状態を確認

## Requirements

- `codex` CLI が利用可能であること
- `codex login` 済み、または `CODEX_API_KEY` / `OPENAI_API_KEY` が設定済みであること

### WSL 利用時の注意

拡張は **WSL の拡張ホスト**で動作します。WSL の環境変数に `codex` が見えないと動きません。
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
5. 必要なら編集し、「Create Branch」アクションボタンでブランチを作成
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

- `codexCommit.codexPath`
  `codex` CLI の実行パス。空の場合は PATH から解決します。

- `codexCommit.promptTemplate`
  コミットメッセージ生成のプロンプトテンプレート。`{{diff}}` が差分に置換されます。

- `codexCommit.branchPromptTemplate`
  ブランチ名生成のプロンプトテンプレート。`{{diff}}` が staged+unstaged 差分に置換されます。

- `codexCommit.model`
  `codex exec --model` に渡すモデル名（設定画面の選択肢から選べます）。未設定の場合は `codex` CLI のデフォルトを使います。
  Settings の各モデル説明に、利用可能な effort の種類を記載しています。

- `codexCommit.effort`
  `codex exec -c model_reasoning_effort=...` に渡す effort。未設定（空文字）の場合は effort を渡さず、`codex` CLI / モデルのデフォルト動作を使います。

- `codexCommit.debugLog`
  デバッグログを `Codex Commit` 出力チャネルに出力します。

## Commands

- `Generate Commit Message (codex)` (`codexCommit.generate`)
- `Generate Branch Name (codex)` (`codexCommit.generateBranchName`)
- `Regenerate Branch Name (codex)` (`codexCommit.regenerateBranchName`)
- `Create Branch` (`codexCommit.createBranchFromGeneratedInput`)
- `Codex Commit: Diagnostics` (`codexCommit.diagnostics`)

## Troubleshooting

### `codex` が見つからない

- `codexCommit.codexPath` を設定する
- または `~/.vscode-server/server-env-setup` で PATH を追加する

### 認証エラーになる

- `codex login` を実行
- もしくは `CODEX_API_KEY` / `OPENAI_API_KEY` を設定

## License

MIT. See [LICENSE.md](LICENSE.md).
